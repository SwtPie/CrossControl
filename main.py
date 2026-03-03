import webview
import json
import sqlite3
import os
import sys
import traceback
import logging
from datetime import datetime

# ── LOGGING ──────────────────────────────────────────────────────────────────
LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cross_debug.log")
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),          # console
        logging.FileHandler(LOG_PATH, encoding="utf-8"),  # fichier
    ]
)
log = logging.getLogger("cross")

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cross_data.db")
log.info(f"DB path : {DB_PATH}")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def parse_arg(data):
    """pywebview peut passer un dict OU une string JSON selon la version — on normalise."""
    if isinstance(data, str):
        log.debug(f"parse_arg: reçu string JSON → parse")
        return json.loads(data)
    if isinstance(data, dict):
        log.debug(f"parse_arg: reçu dict directement")
        return data
    log.warning(f"parse_arg: type inattendu {type(data)} → {data}")
    return data

def init_db():
    log.info("init_db() — initialisation de la base de données")
    conn = get_db()
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            prenom TEXT NOT NULL,
            classe TEXT,
            etablissement TEXT,
            sexe TEXT,
            vma REAL,
            dossard INTEGER UNIQUE,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            distance REAL,
            vma_min REAL,
            vma_max REAL,
            statut TEXT DEFAULT 'preparation',
            started_at TEXT,
            finished_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS course_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER,
            participant_id INTEGER,
            FOREIGN KEY(course_id) REFERENCES courses(id),
            FOREIGN KEY(participant_id) REFERENCES participants(id)
        );

        CREATE TABLE IF NOT EXISTS arrivees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER,
            participant_id INTEGER,
            ordre_arrivee INTEGER,
            temps_secondes REAL,
            dossard_saisi INTEGER,
            FOREIGN KEY(course_id) REFERENCES courses(id),
            FOREIGN KEY(participant_id) REFERENCES participants(id)
        );
    """)
    conn.commit()
    conn.close()
    log.info("init_db() — OK")


class API:
    # ─── PARTICIPANTS ────────────────────────────────────────────────────────────

    def get_participants(self):
        log.debug("API.get_participants()")
        try:
            conn = get_db()
            rows = conn.execute("SELECT * FROM participants ORDER BY nom, prenom").fetchall()
            conn.close()
            result = [dict(r) for r in rows]
            log.debug(f"  → {len(result)} participants")
            return result
        except Exception as e:
            log.error(f"get_participants ERREUR: {e}\n{traceback.format_exc()}")
            return []

    def add_participant(self, data):
        log.info(f"API.add_participant() — reçu: type={type(data)} val={data}")
        try:
            data = parse_arg(data)
            log.debug(f"  data parsé: {data}")
            conn = get_db()
            conn.execute(
                "INSERT INTO participants (nom, prenom, classe, etablissement, sexe, vma, dossard) VALUES (?,?,?,?,?,?,?)",
                (data['nom'], data['prenom'], data.get('classe',''), data.get('etablissement',''),
                 data.get('sexe',''), data.get('vma', None), data.get('dossard', None))
            )
            conn.commit()
            conn.close()
            log.info(f"  → participant ajouté : {data['nom']} {data['prenom']}")
            return {"success": True}
        except sqlite3.IntegrityError as e:
            log.error(f"  IntegrityError: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            log.error(f"  ERREUR inattendue: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def update_participant(self, pid, data):
        log.info(f"API.update_participant(pid={pid}) — reçu: type={type(data)} val={data}")
        try:
            data = parse_arg(data)
            conn = get_db()
            conn.execute(
                "UPDATE participants SET nom=?, prenom=?, classe=?, etablissement=?, sexe=?, vma=?, dossard=? WHERE id=?",
                (data['nom'], data['prenom'], data.get('classe',''), data.get('etablissement',''),
                 data.get('sexe',''), data.get('vma', None), data.get('dossard', None), pid)
            )
            conn.commit()
            conn.close()
            log.info(f"  → participant {pid} mis à jour")
            return {"success": True}
        except sqlite3.IntegrityError as e:
            log.error(f"  IntegrityError: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def delete_participant(self, pid):
        log.info(f"API.delete_participant(pid={pid})")
        try:
            conn = get_db()
            conn.execute("DELETE FROM participants WHERE id=?", (pid,))
            conn.commit()
            conn.close()
            log.info(f"  → supprimé")
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def auto_assign_dossards(self, start=1):
        log.info(f"API.auto_assign_dossards(start={start})")
        try:
            conn = get_db()
            participants = conn.execute("SELECT id FROM participants ORDER BY id").fetchall()
            for i, p in enumerate(participants):
                conn.execute("UPDATE participants SET dossard=? WHERE id=?", (start + i, p['id']))
            conn.commit()
            conn.close()
            log.info(f"  → {len(participants)} dossards attribués")
            return {"success": True, "count": len(participants)}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    # ─── COURSES ─────────────────────────────────────────────────────────────────

    def get_courses(self):
        log.debug("API.get_courses()")
        try:
            conn = get_db()
            rows = conn.execute("SELECT * FROM courses ORDER BY created_at DESC").fetchall()
            conn.close()
            result = [dict(r) for r in rows]
            log.debug(f"  → {len(result)} courses")
            return result
        except Exception as e:
            log.error(f"get_courses ERREUR: {e}\n{traceback.format_exc()}")
            return []

    def add_course(self, data):
        log.info(f"API.add_course() — reçu: type={type(data)} val={data}")
        try:
            data = parse_arg(data)
            conn = get_db()
            c = conn.execute(
                "INSERT INTO courses (nom, distance, vma_min, vma_max) VALUES (?,?,?,?)",
                (data['nom'], data.get('distance', None), data.get('vma_min', None), data.get('vma_max', None))
            )
            course_id = c.lastrowid
            conn.commit()
            conn.close()
            log.info(f"  → course créée id={course_id}")
            return {"success": True, "id": course_id}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def update_course(self, cid, data):
        log.info(f"API.update_course(cid={cid})")
        try:
            data = parse_arg(data)
            conn = get_db()
            conn.execute(
                "UPDATE courses SET nom=?, distance=?, vma_min=?, vma_max=? WHERE id=?",
                (data['nom'], data.get('distance', None), data.get('vma_min', None), data.get('vma_max', None), cid)
            )
            conn.commit()
            conn.close()
            log.info(f"  → course {cid} mise à jour")
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def delete_course(self, cid):
        log.info(f"API.delete_course(cid={cid})")
        try:
            conn = get_db()
            conn.execute("DELETE FROM course_participants WHERE course_id=?", (cid,))
            conn.execute("DELETE FROM arrivees WHERE course_id=?", (cid,))
            conn.execute("DELETE FROM courses WHERE id=?", (cid,))
            conn.commit()
            conn.close()
            log.info(f"  → course {cid} supprimée")
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def get_course_participants(self, course_id):
        log.debug(f"API.get_course_participants(course_id={course_id})")
        try:
            conn = get_db()
            rows = conn.execute("""
                SELECT p.* FROM participants p
                JOIN course_participants cp ON cp.participant_id = p.id
                WHERE cp.course_id = ?
                ORDER BY p.dossard, p.nom
            """, (course_id,)).fetchall()
            conn.close()
            return [dict(r) for r in rows]
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return []

    def add_participant_to_course(self, course_id, participant_id):
        log.info(f"API.add_participant_to_course(course_id={course_id}, participant_id={participant_id})")
        try:
            conn = get_db()
            existing = conn.execute(
                "SELECT id FROM course_participants WHERE course_id=? AND participant_id=?",
                (course_id, participant_id)
            ).fetchone()
            if not existing:
                conn.execute("INSERT INTO course_participants (course_id, participant_id) VALUES (?,?)",
                             (course_id, participant_id))
                conn.commit()
            conn.close()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def remove_participant_from_course(self, course_id, participant_id):
        log.info(f"API.remove_participant_from_course(course_id={course_id}, participant_id={participant_id})")
        try:
            conn = get_db()
            conn.execute("DELETE FROM course_participants WHERE course_id=? AND participant_id=?",
                         (course_id, participant_id))
            conn.commit()
            conn.close()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def auto_add_by_vma(self, course_id):
        log.info(f"API.auto_add_by_vma(course_id={course_id})")
        try:
            conn = get_db()
            course = conn.execute("SELECT * FROM courses WHERE id=?", (course_id,)).fetchone()
            if not course:
                conn.close()
                return {"success": False, "error": "Course introuvable"}
            vma_min = course['vma_min']
            vma_max = course['vma_max']
            log.debug(f"  vma_min={vma_min}, vma_max={vma_max}")
            if vma_min is None or vma_max is None:
                conn.close()
                return {"success": False, "error": "VMA min/max non définis sur cette course"}
            participants = conn.execute(
                "SELECT id FROM participants WHERE vma >= ? AND vma <= ?", (vma_min, vma_max)
            ).fetchall()
            count = 0
            for p in participants:
                existing = conn.execute(
                    "SELECT id FROM course_participants WHERE course_id=? AND participant_id=?",
                    (course_id, p['id'])
                ).fetchone()
                if not existing:
                    conn.execute("INSERT INTO course_participants (course_id, participant_id) VALUES (?,?)",
                                 (course_id, p['id']))
                    count += 1
            conn.commit()
            conn.close()
            log.info(f"  → {count} participants ajoutés par VMA")
            return {"success": True, "count": count}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    # ─── GESTION DE COURSE (TIMER / ARRIVÉES) ────────────────────────────────────

    def start_course(self, course_id):
        log.info(f"API.start_course(course_id={course_id})")
        try:
            conn = get_db()
            now = datetime.now().isoformat()
            conn.execute("UPDATE courses SET statut='en_cours', started_at=? WHERE id=?", (now, course_id))
            conn.commit()
            conn.close()
            return {"success": True, "started_at": now}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def finish_course(self, course_id):
        log.info(f"API.finish_course(course_id={course_id})")
        try:
            conn = get_db()
            now = datetime.now().isoformat()
            conn.execute("UPDATE courses SET statut='terminee', finished_at=? WHERE id=?", (now, course_id))
            conn.commit()
            conn.close()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def reset_course(self, course_id):
        log.info(f"API.reset_course(course_id={course_id})")
        try:
            conn = get_db()
            conn.execute("DELETE FROM arrivees WHERE course_id=?", (course_id,))
            conn.execute("UPDATE courses SET statut='preparation', started_at=NULL, finished_at=NULL WHERE id=?", (course_id,))
            conn.commit()
            conn.close()
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def enregistrer_arrivee(self, course_id, temps_secondes):
        log.info(f"API.enregistrer_arrivee(course_id={course_id}, temps={temps_secondes})")
        try:
            conn = get_db()
            ordre = conn.execute(
                "SELECT COUNT(*) as cnt FROM arrivees WHERE course_id=?", (course_id,)
            ).fetchone()['cnt'] + 1
            conn.execute(
                "INSERT INTO arrivees (course_id, ordre_arrivee, temps_secondes) VALUES (?,?,?)",
                (course_id, ordre, temps_secondes)
            )
            conn.commit()
            arrivee_id = conn.execute(
                "SELECT id FROM arrivees WHERE course_id=? AND ordre_arrivee=?", (course_id, ordre)
            ).fetchone()['id']
            conn.close()
            log.info(f"  → arrivée #{ordre} enregistrée (id={arrivee_id})")
            return {"success": True, "ordre": ordre, "arrivee_id": arrivee_id}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def assigner_dossard_arrivee(self, arrivee_id, dossard):
        log.info(f"API.assigner_dossard_arrivee(arrivee_id={arrivee_id}, dossard={dossard})")
        try:
            conn = get_db()
            participant = conn.execute(
                "SELECT id FROM participants WHERE dossard=?", (dossard,)
            ).fetchone()
            if not participant:
                conn.close()
                log.warning(f"  → dossard {dossard} introuvable")
                return {"success": False, "error": f"Dossard {dossard} introuvable"}
            conn.execute(
                "UPDATE arrivees SET dossard_saisi=?, participant_id=? WHERE id=?",
                (dossard, participant['id'], arrivee_id)
            )
            conn.commit()
            conn.close()
            log.info(f"  → dossard assigné à participant id={participant['id']}")
            return {"success": True}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def get_arrivees(self, course_id):
        log.debug(f"API.get_arrivees(course_id={course_id})")
        try:
            conn = get_db()
            rows = conn.execute("""
                SELECT a.*, p.nom, p.prenom, p.classe, p.etablissement, p.sexe, p.vma, p.dossard as dossard_participant
                FROM arrivees a
                LEFT JOIN participants p ON p.id = a.participant_id
                WHERE a.course_id = ?
                ORDER BY a.ordre_arrivee
            """, (course_id,)).fetchall()
            conn.close()
            return [dict(r) for r in rows]
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return []

    def get_classement(self, course_id):
        log.debug(f"API.get_classement(course_id={course_id})")
        try:
            conn = get_db()
            course = conn.execute("SELECT * FROM courses WHERE id=?", (course_id,)).fetchone()
            if not course:
                conn.close()
                return []
            rows = conn.execute("""
                SELECT a.*, p.nom, p.prenom, p.classe, p.etablissement, p.sexe, p.vma, p.dossard as num_dossard
                FROM arrivees a
                LEFT JOIN participants p ON p.id = a.participant_id
                WHERE a.course_id = ? AND a.participant_id IS NOT NULL
                ORDER BY a.ordre_arrivee
            """, (course_id,)).fetchall()
            classement = []
            distance = course['distance']
            for r in rows:
                d = dict(r)
                if d['temps_secondes'] and d['temps_secondes'] > 0 and distance:
                    vitesse_ms = distance / d['temps_secondes']
                    vitesse_kmh = vitesse_ms * 3.6
                    d['vitesse_kmh'] = round(vitesse_kmh, 2)
                    if d['vma'] and d['vma'] > 0:
                        d['pct_vma'] = round((vitesse_kmh / d['vma']) * 100, 1)
                    else:
                        d['pct_vma'] = None
                else:
                    d['vitesse_kmh'] = None
                    d['pct_vma'] = None
                classement.append(d)
            conn.close()
            log.debug(f"  → {len(classement)} résultats")
            return classement
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return []

    def get_stats(self):
        log.debug("API.get_stats()")
        try:
            conn = get_db()
            nb_participants = conn.execute("SELECT COUNT(*) as c FROM participants").fetchone()['c']
            nb_courses = conn.execute("SELECT COUNT(*) as c FROM courses").fetchone()['c']
            nb_arrivees = conn.execute("SELECT COUNT(*) as c FROM arrivees WHERE participant_id IS NOT NULL").fetchone()['c']
            conn.close()
            return {"participants": nb_participants, "courses": nb_courses, "arrivees": nb_arrivees}
        except Exception as e:
            log.error(f"  ERREUR: {e}\n{traceback.format_exc()}")
            return {"participants": 0, "courses": 0, "arrivees": 0}


def main():
    log.info("=== Démarrage Cross Manager ===")
    log.info(f"Python {sys.version}")
    log.info(f"pywebview {getattr(webview, '__version__', 'version inconnue')}")
    log.info(f"DB : {DB_PATH}")
    log.info(f"Log : {LOG_PATH}")
    init_db()
    api = API()
    html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.html")
    log.info(f"HTML : {html_path}")
    window = webview.create_window(
        "🏃 Gestionnaire de Cross",
        html_path,
        js_api=api,
        width=1280,
        height=800,
        min_size=(900, 600)
    )
    log.info("Lancement de webview.start(debug=True)")
    webview.start(debug=True)   # ← debug=True : ouvre les DevTools (F12)


if __name__ == "__main__":
    main()