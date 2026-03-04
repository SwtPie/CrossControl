import webview
import json
import sqlite3
import os
import sys
import re
import traceback
import logging
from datetime import datetime

# ── LOGGING ──────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
LOG_PATH  = os.path.join(BASE_DIR, "cross_debug.log")
RACES_DIR = os.path.join(BASE_DIR, "races")
EVENTS_DB = os.path.join(BASE_DIR, "events.db")

os.makedirs(RACES_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
    ]
)
log = logging.getLogger("cross")
log.info(f"BASE_DIR  : {BASE_DIR}")
log.info(f"EVENTS_DB : {EVENTS_DB}")
log.info(f"RACES_DIR : {RACES_DIR}")

# ── CONNEXIONS ────────────────────────────────────────────────────────────────
_events_conn = None   # connexion à events.db
_event_conn  = None   # connexion à la DB de l'événement actif
_event_info  = None   # dict {id, nom, date, lieu} de l'événement actif

def get_events_db():
    global _events_conn
    if _events_conn is None:
        _events_conn = sqlite3.connect(EVENTS_DB, check_same_thread=False, timeout=10)
        _events_conn.row_factory = sqlite3.Row
        _events_conn.execute("PRAGMA journal_mode=DELETE")
        log.info("events.db connecté")
    return _events_conn

def get_event_db():
    if _event_conn is None:
        raise RuntimeError("Aucun événement ouvert")
    return _event_conn

def open_event_db(db_path):
    global _event_conn
    if _event_conn is not None:
        try:
            _event_conn.close()
        except Exception:
            pass
    _event_conn = sqlite3.connect(db_path, check_same_thread=False, timeout=10)
    _event_conn.row_factory = sqlite3.Row
    _event_conn.execute("PRAGMA journal_mode=DELETE")
    log.info(f"Event DB ouverte : {db_path}")
    return _event_conn

def parse_arg(data):
    if isinstance(data, str):
        return json.loads(data)
    if isinstance(data, dict):
        return data
    return data

def slugify(text):
    text = text.lower().strip()
    for src, dst in [("àâä","a"),("éèêë","e"),("îï","i"),("ôö","o"),("ùûü","u"),("ç","c")]:
        for c in src:
            text = text.replace(c, dst)
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return text or "evenement"

# ── INIT EVENTS DB ────────────────────────────────────────────────────────────
def init_events_db():
    conn = get_events_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS evenements (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            nom         TEXT NOT NULL,
            date        TEXT,
            lieu        TEXT,
            description TEXT,
            slug        TEXT UNIQUE NOT NULL,
            db_path     TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    log.info("init_events_db() OK")

# ── INIT EVENT DB SCHEMA ──────────────────────────────────────────────────────
def init_event_db(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS participants (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            nom           TEXT NOT NULL,
            prenom        TEXT NOT NULL,
            classe        TEXT,
            etablissement TEXT,
            sexe          TEXT,
            vma           REAL,
            dossard       INTEGER UNIQUE,
            created_at    TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS courses (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            nom         TEXT NOT NULL,
            distance    REAL,
            vma_min     REAL,
            vma_max     REAL,
            statut      TEXT DEFAULT 'preparation',
            started_at  TEXT,
            finished_at TEXT,
            masquee     INTEGER DEFAULT 0,
            created_at  TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS course_participants (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id      INTEGER,
            participant_id INTEGER,
            FOREIGN KEY(course_id)      REFERENCES courses(id),
            FOREIGN KEY(participant_id) REFERENCES participants(id)
        );
        CREATE TABLE IF NOT EXISTS arrivees (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id      INTEGER,
            participant_id INTEGER,
            ordre_arrivee  INTEGER,
            temps_secondes REAL,
            dossard_saisi  INTEGER,
            FOREIGN KEY(course_id)      REFERENCES courses(id),
            FOREIGN KEY(participant_id) REFERENCES participants(id)
        );
    """)
    conn.commit()
    try:
        conn.execute("ALTER TABLE courses ADD COLUMN masquee INTEGER DEFAULT 0")
        conn.commit()
    except Exception:
        pass


# ════════════════════════════════════════════════════════════════════════════════
# API
# ════════════════════════════════════════════════════════════════════════════════
class API:

    # ─── GESTION DES ÉVÉNEMENTS ──────────────────────────────────────────────────

    def get_evenements(self):
        log.debug("API.get_evenements()")
        try:
            conn = get_events_db()
            rows = conn.execute("SELECT * FROM evenements ORDER BY created_at DESC").fetchall()
            result = []
            for r in rows:
                e = dict(r)
                try:
                    ec = sqlite3.connect(e['db_path'])
                    ec.row_factory = sqlite3.Row
                    e['nb_participants'] = ec.execute("SELECT COUNT(*) as c FROM participants").fetchone()['c']
                    e['nb_courses']      = ec.execute("SELECT COUNT(*) as c FROM courses").fetchone()['c']
                    ec.close()
                except Exception:
                    e['nb_participants'] = 0
                    e['nb_courses']      = 0
                result.append(e)
            return result
        except Exception as e:
            log.error(f"get_evenements ERREUR: {e}\n{traceback.format_exc()}")
            return []

    def create_evenement(self, data):
        log.info(f"API.create_evenement()")
        try:
            data = parse_arg(data)
            nom  = data.get('nom', '').strip()
            if not nom:
                return {"success": False, "error": "Nom requis"}
            conn      = get_events_db()
            base_slug = slugify(nom)
            slug, i   = base_slug, 1
            while conn.execute("SELECT id FROM evenements WHERE slug=?", (slug,)).fetchone():
                slug = f"{base_slug}_{i}"; i += 1
            db_path = os.path.join(RACES_DIR, f"{slug}.db")
            ec = sqlite3.connect(db_path)
            init_event_db(ec)
            ec.close()
            conn.execute(
                "INSERT INTO evenements (nom, date, lieu, description, slug, db_path) VALUES (?,?,?,?,?,?)",
                (nom, data.get('date',''), data.get('lieu',''), data.get('description',''), slug, db_path)
            )
            conn.commit()
            log.info(f"  → événement créé : {slug}")
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def update_evenement(self, eid, data):
        log.info(f"API.update_evenement(eid={eid})")
        try:
            data = parse_arg(data)
            conn = get_events_db()
            conn.execute(
                "UPDATE evenements SET nom=?, date=?, lieu=?, description=? WHERE id=?",
                (data['nom'], data.get('date',''), data.get('lieu',''), data.get('description',''), eid)
            )
            conn.commit()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def delete_evenement(self, eid):
        log.info(f"API.delete_evenement(eid={eid})")
        try:
            conn = get_events_db()
            row  = conn.execute("SELECT db_path FROM evenements WHERE id=?", (eid,)).fetchone()
            if row:
                try:
                    os.remove(row['db_path'])
                except FileNotFoundError:
                    pass
            conn.execute("DELETE FROM evenements WHERE id=?", (eid,))
            conn.commit()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def open_evenement(self, eid):
        global _event_info
        log.info(f"API.open_evenement(eid={eid})")
        try:
            conn = get_events_db()
            row  = conn.execute("SELECT * FROM evenements WHERE id=?", (eid,)).fetchone()
            if not row:
                return {"success": False, "error": "Événement introuvable"}
            ec = open_event_db(row['db_path'])
            init_event_db(ec)
            _event_info = {"id": row['id'], "nom": row['nom'], "date": row['date'], "lieu": row['lieu']}
            log.info(f"  → ouvert : {row['nom']}")
            return {"success": True, "evenement": _event_info}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def close_evenement(self):
        global _event_conn, _event_info
        log.info("API.close_evenement()")
        if _event_conn:
            try:
                _event_conn.close()
            except Exception:
                pass
            _event_conn = None
        _event_info = None
        return {"success": True}

    def get_current_evenement(self):
        return _event_info  # None si aucun événement ouvert

    # ─── PARTICIPANTS ────────────────────────────────────────────────────────────

    def get_participants(self):
        try:
            rows = get_event_db().execute("SELECT * FROM participants ORDER BY nom, prenom").fetchall()
            return [dict(r) for r in rows]
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return []

    def add_participant(self, data):
        log.info(f"API.add_participant() val={data}")
        try:
            data = parse_arg(data)
            get_event_db().execute(
                "INSERT INTO participants (nom, prenom, classe, etablissement, sexe, vma, dossard) VALUES (?,?,?,?,?,?,?)",
                (data['nom'], data['prenom'], data.get('classe',''), data.get('etablissement',''),
                 data.get('sexe',''), data.get('vma'), data.get('dossard'))
            )
            get_event_db().commit()
            return {"success": True}
        except sqlite3.IntegrityError as e:
            if "participants.dossard" in str(e):
                return {"success": False, "error": f"Le dossard {data.get('dossard')} est déjà attribué."}
            return {"success": False, "error": str(e)}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def update_participant(self, pid, data):
        try:
            data = parse_arg(data)
            get_event_db().execute(
                "UPDATE participants SET nom=?, prenom=?, classe=?, etablissement=?, sexe=?, vma=?, dossard=? WHERE id=?",
                (data['nom'], data['prenom'], data.get('classe',''), data.get('etablissement',''),
                 data.get('sexe',''), data.get('vma'), data.get('dossard'), pid)
            )
            get_event_db().commit()
            return {"success": True}
        except sqlite3.IntegrityError as e:
            if "participants.dossard" in str(e):
                return {"success": False, "error": f"Le dossard {data.get('dossard')} est déjà attribué."}
            return {"success": False, "error": str(e)}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def delete_participant(self, pid):
        try:
            get_event_db().execute("DELETE FROM participants WHERE id=?", (pid,))
            get_event_db().commit()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def auto_assign_dossards(self, start=1):
        try:
            conn = get_event_db()
            participants = conn.execute("SELECT id FROM participants ORDER BY id").fetchall()
            for i, p in enumerate(participants):
                conn.execute("UPDATE participants SET dossard=? WHERE id=?", (start + i, p['id']))
            conn.commit()
            return {"success": True, "count": len(participants)}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    # ─── COURSES ─────────────────────────────────────────────────────────────────

    def get_courses(self):
        try:
            rows = get_event_db().execute("SELECT * FROM courses ORDER BY created_at DESC").fetchall()
            return [dict(r) for r in rows]
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return []

    def add_course(self, data):
        try:
            data = parse_arg(data)
            conn = get_event_db()
            c = conn.execute(
                "INSERT INTO courses (nom, distance, vma_min, vma_max) VALUES (?,?,?,?)",
                (data['nom'], data.get('distance'), data.get('vma_min'), data.get('vma_max'))
            )
            conn.commit()
            return {"success": True, "id": c.lastrowid}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def update_course(self, cid, data):
        try:
            data = parse_arg(data)
            conn = get_event_db()
            conn.execute(
                "UPDATE courses SET nom=?, distance=?, vma_min=?, vma_max=? WHERE id=?",
                (data['nom'], data.get('distance'), data.get('vma_min'), data.get('vma_max'), cid)
            )
            conn.commit()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def delete_course(self, cid):
        try:
            conn = get_event_db()
            conn.execute("DELETE FROM course_participants WHERE course_id=?", (cid,))
            conn.execute("DELETE FROM arrivees WHERE course_id=?", (cid,))
            conn.execute("DELETE FROM courses WHERE id=?", (cid,))
            conn.commit()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def get_course_participants(self, course_id):
        try:
            rows = get_event_db().execute("""
                SELECT p.* FROM participants p
                JOIN course_participants cp ON cp.participant_id = p.id
                WHERE cp.course_id = ? ORDER BY p.dossard, p.nom
            """, (course_id,)).fetchall()
            return [dict(r) for r in rows]
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return []

    def add_participant_to_course(self, course_id, participant_id):
        try:
            conn = get_event_db()
            if not conn.execute("SELECT id FROM course_participants WHERE course_id=? AND participant_id=?",
                                (course_id, participant_id)).fetchone():
                conn.execute("INSERT INTO course_participants (course_id, participant_id) VALUES (?,?)",
                             (course_id, participant_id))
                conn.commit()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def remove_participant_from_course(self, course_id, participant_id):
        try:
            conn = get_event_db()
            conn.execute("DELETE FROM course_participants WHERE course_id=? AND participant_id=?",
                         (course_id, participant_id))
            conn.commit()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def auto_add_by_vma(self, course_id):
        try:
            conn   = get_event_db()
            course = conn.execute("SELECT * FROM courses WHERE id=?", (course_id,)).fetchone()
            if not course:
                return {"success": False, "error": "Course introuvable"}
            if course['vma_min'] is None or course['vma_max'] is None:
                return {"success": False, "error": "VMA min/max non définis"}
            parts = conn.execute("SELECT id FROM participants WHERE vma >= ? AND vma <= ?",
                                 (course['vma_min'], course['vma_max'])).fetchall()
            count = 0
            for p in parts:
                if not conn.execute("SELECT id FROM course_participants WHERE course_id=? AND participant_id=?",
                                    (course_id, p['id'])).fetchone():
                    conn.execute("INSERT INTO course_participants (course_id, participant_id) VALUES (?,?)",
                                 (course_id, p['id']))
                    count += 1
            conn.commit()
            return {"success": True, "count": count}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def toggle_masquer_course(self, cid):
        try:
            conn    = get_event_db()
            current = conn.execute("SELECT masquee FROM courses WHERE id=?", (cid,)).fetchone()
            if not current:
                return {"success": False, "error": "Course introuvable"}
            new_val = 0 if current["masquee"] else 1
            conn.execute("UPDATE courses SET masquee=? WHERE id=?", (new_val, cid))
            conn.commit()
            return {"success": True, "masquee": new_val}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def get_courses_terminees(self):
        try:
            rows = get_event_db().execute(
                "SELECT * FROM courses WHERE statut='terminee' ORDER BY finished_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return []

    # ─── COURSE EN DIRECT ────────────────────────────────────────────────────────

    def start_course(self, course_id):
        try:
            conn = get_event_db()
            now  = datetime.now().isoformat()
            conn.execute("UPDATE courses SET statut='en_cours', started_at=? WHERE id=?", (now, course_id))
            conn.commit()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def finish_course(self, course_id):
        try:
            conn = get_event_db()
            conn.execute("UPDATE courses SET statut='terminee', finished_at=? WHERE id=?",
                         (datetime.now().isoformat(), course_id))
            conn.commit()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def reset_course(self, course_id):
        try:
            conn = get_event_db()
            conn.execute("DELETE FROM arrivees WHERE course_id=?", (course_id,))
            conn.execute("UPDATE courses SET statut='preparation', started_at=NULL, finished_at=NULL WHERE id=?",
                         (course_id,))
            conn.commit()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def enregistrer_arrivee(self, course_id, temps_secondes):
        try:
            conn  = get_event_db()
            ordre = conn.execute("SELECT COUNT(*) as cnt FROM arrivees WHERE course_id=?",
                                 (course_id,)).fetchone()['cnt'] + 1
            conn.execute("INSERT INTO arrivees (course_id, ordre_arrivee, temps_secondes) VALUES (?,?,?)",
                         (course_id, ordre, temps_secondes))
            conn.commit()
            aid = conn.execute("SELECT id FROM arrivees WHERE course_id=? AND ordre_arrivee=?",
                               (course_id, ordre)).fetchone()['id']
            return {"success": True, "ordre": ordre, "arrivee_id": aid}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def assigner_dossard_arrivee(self, arrivee_id, dossard):
        try:
            conn = get_event_db()
            p    = conn.execute("SELECT id FROM participants WHERE dossard=?", (dossard,)).fetchone()
            if not p:
                return {"success": False, "error": f"Dossard {dossard} introuvable"}
            conn.execute("UPDATE arrivees SET dossard_saisi=?, participant_id=? WHERE id=?",
                         (dossard, p['id'], arrivee_id))
            conn.commit()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def get_arrivees(self, course_id):
        try:
            rows = get_event_db().execute("""
                SELECT a.*, p.nom, p.prenom, p.classe, p.etablissement, p.sexe, p.vma,
                       p.dossard as dossard_participant
                FROM arrivees a
                LEFT JOIN participants p ON p.id = a.participant_id
                WHERE a.course_id = ? ORDER BY a.ordre_arrivee
            """, (course_id,)).fetchall()
            return [dict(r) for r in rows]
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return []

    def supprimer_arrivee(self, arrivee_id):
        try:
            conn = get_event_db()
            a    = conn.execute("SELECT * FROM arrivees WHERE id=?", (arrivee_id,)).fetchone()
            if not a:
                return {"success": False, "error": "Arrivée introuvable"}
            conn.execute("DELETE FROM arrivees WHERE id=?", (arrivee_id,))
            conn.execute("UPDATE arrivees SET ordre_arrivee=ordre_arrivee-1 WHERE course_id=? AND ordre_arrivee>?",
                         (a['course_id'], a['ordre_arrivee']))
            conn.commit()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def ajouter_arrivee_manuelle(self, course_id, temps_secondes, dossard):
        try:
            conn = get_event_db()
            p    = conn.execute("SELECT id FROM participants WHERE dossard=?", (dossard,)).fetchone()
            if not p:
                return {"success": False, "error": f"Dossard {dossard} introuvable"}
            ordre = conn.execute("SELECT COUNT(*) as cnt FROM arrivees WHERE course_id=?",
                                 (course_id,)).fetchone()['cnt'] + 1
            conn.execute("INSERT INTO arrivees (course_id, ordre_arrivee, temps_secondes, dossard_saisi, participant_id) VALUES (?,?,?,?,?)",
                         (course_id, ordre, temps_secondes, dossard, p['id']))
            conn.commit()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return {"success": False, "error": str(e)}

    def get_classement(self, course_id):
        try:
            conn   = get_event_db()
            course = conn.execute("SELECT * FROM courses WHERE id=?", (course_id,)).fetchone()
            if not course:
                return []
            rows = conn.execute("""
                SELECT a.*, p.nom, p.prenom, p.classe, p.etablissement, p.sexe, p.vma,
                       p.dossard as num_dossard
                FROM arrivees a
                LEFT JOIN participants p ON p.id = a.participant_id
                WHERE a.course_id=? AND a.participant_id IS NOT NULL ORDER BY a.ordre_arrivee
            """, (course_id,)).fetchall()
            result = []
            for r in rows:
                d = dict(r)
                if d['temps_secondes'] and d['temps_secondes'] > 0 and course['distance']:
                    v = (course['distance'] / d['temps_secondes']) * 3.6
                    d['vitesse_kmh'] = round(v, 2)
                    d['pct_vma']     = round((v / d['vma']) * 100, 1) if d['vma'] else None
                else:
                    d['vitesse_kmh'] = None
                    d['pct_vma']     = None
                result.append(d)
            return result
        except Exception as e:
            log.error(f"  ERREUR: {e}"); return []

    def get_stats(self):
        try:
            conn = get_event_db()
            return {
                "participants": conn.execute("SELECT COUNT(*) as c FROM participants").fetchone()['c'],
                "courses":      conn.execute("SELECT COUNT(*) as c FROM courses").fetchone()['c'],
                "arrivees":     conn.execute("SELECT COUNT(*) as c FROM arrivees WHERE participant_id IS NOT NULL").fetchone()['c'],
            }
        except Exception:
            return {"participants": 0, "courses": 0, "arrivees": 0}


# ════════════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════════════
def main():
    log.info("=== Démarrage CrossControl ===")
    log.info(f"Python {sys.version}")
    init_events_db()
    html_path = os.path.join(BASE_DIR, "app.html")
    webview.create_window(
        "CrossControl",
        html_path,
        js_api=API(),
        width=1920,
        height=1080,
        min_size=(900, 600)
    )
    webview.start(debug=True)

if __name__ == "__main__":
    main()