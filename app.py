from flask import Flask, render_template, request, jsonify
import sqlite3
import datetime
import os
import time  # NUEVO: Importación para manejar el cronómetro exacto

app = Flask(__name__, static_folder='static', template_folder='templates')

DATABASE = 'torneo_robots.db'
CODIGO_ADMIN = "9999"

def conectar_bd():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def inicializar_bd():
    conn = conectar_bd()
    cursor = conn.cursor()
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS configuracion (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        registro_abierto INTEGER DEFAULT 1)''')
    
    cursor.execute("SELECT COUNT(*) FROM configuracion")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO configuracion (registro_abierto) VALUES (1)")
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS categorias (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        codigo TEXT UNIQUE,
                        nombre TEXT)''')
    
    cursor.execute("SELECT COUNT(*) FROM categorias")
    if cursor.fetchone()[0] == 0:
        codigos_iniciales = [("1111", "Pequeños"), ("2222", "Mediano"), ("3333", "Grandes"), 
                             ("4444", "Seguimiento de línea"), ("5555", "Evasor de obstáculos")]
        cursor.executemany("INSERT INTO categorias (codigo, nombre) VALUES (?, ?)", codigos_iniciales)

    cursor.execute('''CREATE TABLE IF NOT EXISTS jueces (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        nombre TEXT, categoria_id INTEGER,
                        FOREIGN KEY(categoria_id) REFERENCES categorias(id))''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS archivos_excel (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        nombre_archivo TEXT NOT NULL,
                        fecha_carga TEXT NOT NULL)''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS competidores (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        nombre TEXT NOT NULL,
                        categoria_tag TEXT NOT NULL, 
                        docente TEXT,
                        archivo_id INTEGER,
                        UNIQUE(nombre, categoria_tag),
                        FOREIGN KEY(archivo_id) REFERENCES archivos_excel(id)
                    )''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS tiempos_carreras (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        competidor_name TEXT NOT NULL,
                        categoria_tag TEXT NOT NULL,
                        tiempo_segundos REAL NOT NULL)''')

    # NUEVA TABLA: Control de arena en tiempo real
    cursor.execute('''CREATE TABLE IF NOT EXISTS arena_activa (
                        categoria_tag TEXT PRIMARY KEY,
                        robot1 TEXT,
                        robot2 TEXT,
                        tiempo_inicio REAL,
                        estado TEXT DEFAULT 'inactivo'
                    )''')
    
    conn.commit()
    conn.close()

# --- RUTAS DE LOGIN Y JUECES ---
@app.route('/')
def home(): return render_template('portal_jueces.html')

@app.route('/api/login_juez', methods=['POST'])
def login_juez():
    data = request.get_json()
    nombre, codigo, cat_solicitada = data.get('nombre'), data.get('codigo'), data.get('categoria')

    if codigo == CODIGO_ADMIN:
        conn = conectar_bd()
        estado_registro = conn.execute("SELECT registro_abierto FROM configuracion WHERE id = 1").fetchone()['registro_abierto']
        conn.close()
        return jsonify({"role": "admin", "estado_registro": estado_registro})

    conn = conectar_bd()
    cursor = conn.cursor()
    if cursor.execute("SELECT registro_abierto FROM configuracion WHERE id = 1").fetchone()['registro_abierto'] == 0:
        return jsonify({"success": False, "message": "❌ Los registros están cerrados por el Administrador."}), 403

    cat_info = cursor.execute("SELECT id, codigo FROM categorias WHERE nombre = ?", (cat_solicitada,)).fetchone()
    if not cat_info: return jsonify({"success": False, "message": "❌ Categoría no válida."}), 400
    if codigo != cat_info['codigo']: return jsonify({"success": False, "message": "❌ PIN incorrecto."}), 401

    juez_existente = cursor.execute('''SELECT categorias.nombre FROM jueces JOIN categorias ON jueces.categoria_id = categorias.id WHERE jueces.nombre = ?''', (nombre,)).fetchone()
    if juez_existente and juez_existente['nombre'] != cat_solicitada:
        return jsonify({"success": False, "message": f"❌ Juez ya asignado a: {juez_existente['nombre']}."}), 403
            
    if not juez_existente:
        cursor.execute("INSERT INTO jueces (nombre, categoria_id) VALUES (?, ?)", (nombre, cat_info['id']))
        conn.commit()
    conn.close()
    return jsonify({"success": True, "nombre": nombre, "categoria": cat_solicitada})

@app.route('/api/admin/toggle_registro', methods=['POST'])
def toggle_registro():
    conn = conectar_bd()
    estado_actual = conn.execute("SELECT registro_abierto FROM configuracion WHERE id = 1").fetchone()['registro_abierto']
    nuevo_estado = 0 if estado_actual == 1 else 1
    conn.execute("UPDATE configuracion SET registro_abierto = ? WHERE id = 1", (nuevo_estado,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "nuevo_estado": nuevo_estado})

@app.route('/api/admin/jueces', methods=['GET'])
def obtener_jueces():
    jueces = [dict(row) for row in conectar_bd().execute('''SELECT jueces.id, jueces.nombre, categorias.nombre AS categoria FROM jueces JOIN categorias ON jueces.categoria_id = categorias.id ORDER BY categorias.nombre ASC, jueces.nombre ASC''').fetchall()]
    return jsonify({"success": True, "jueces": jueces})

@app.route('/api/admin/eliminar_juez/<int:juez_id>', methods=['POST'])
def eliminar_juez(juez_id):
    conn = conectar_bd()
    conn.execute("DELETE FROM jueces WHERE id = ?", (juez_id,))
    conn.commit()
    return jsonify({"success": True, "message": "Juez eliminado."})

@app.route('/api/admin/archivos', methods=['GET'])
def obtener_archivos():
    archivos = [dict(row) for row in conectar_bd().execute("SELECT * FROM archivos_excel ORDER BY id DESC").fetchall()]
    return jsonify({"success": True, "archivos": archivos})

@app.route('/api/admin/eliminar_archivo/<int:archivo_id>', methods=['POST'])
def eliminar_archivo(archivo_id):
    conn = conectar_bd()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM competidores WHERE archivo_id = ?", (archivo_id,))
        cursor.execute("DELETE FROM archivos_excel WHERE id = ?", (archivo_id,))
        cursor.execute("DELETE FROM tiempos_carreras WHERE competidor_name NOT IN (SELECT nombre FROM competidores)")
        conn.commit()
        return jsonify({"success": True, "message": "Archivo y registros asociados eliminados."})
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)})
    finally:
        conn.close()

@app.route('/api/competidores/guardar_masivo', methods=['POST'])
def guardar_competidores_masivo():
    data = request.get_json()
    lista_equipos = data.get('equipos', [])
    nombre_archivo = data.get('nombre_archivo', 'Carga_Manual.xlsx')

    if not lista_equipos: return jsonify({"success": False, "message": "Sin datos."}), 400

    conn = conectar_bd()
    cursor = conn.cursor()
    try:
        fecha_actual = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("INSERT INTO archivos_excel (nombre_archivo, fecha_carga) VALUES (?, ?)", (nombre_archivo, fecha_actual))
        archivo_id = cursor.lastrowid 
        
        for eq in lista_equipos:
            cursor.execute('''INSERT OR IGNORE INTO competidores (nombre, categoria_tag, docente, archivo_id) 
                              VALUES (?, ?, ?, ?)''', (eq['nombre'], eq['categoria'], eq.get('docente', ''), archivo_id))
            
        conn.commit()
        return jsonify({"success": True, "message": "Equipos añadidos al padrón oficial."})
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)})
    finally:
        conn.close()

@app.route('/api/competidores/obtener_todos', methods=['GET'])
def obtener_todos_competidores():
    conn = conectar_bd()
    comps = [dict(row) for row in conn.execute("SELECT nombre, categoria_tag, docente FROM competidores").fetchall()]
    tiempos = [dict(row) for row in conn.execute("SELECT id, competidor_name AS name, categoria_tag, tiempo_segundos AS timeSeconds FROM tiempos_carreras").fetchall()]
    conn.close()
    return jsonify({"success": True, "competidores": comps, "tiempos": tiempos})

@app.route('/api/tiempos/registrar', methods=['POST'])
def registrar_tiempo():
    data = request.get_json()
    conn = conectar_bd()
    conn.execute("INSERT INTO tiempos_carreras (competidor_name, categoria_tag, tiempo_segundos) VALUES (?, ?, ?)", (data['name'], data['categoria'], data['timeSeconds']))
    conn.commit()
    return jsonify({"success": True})

@app.route('/api/tiempos/eliminar/<int:tiempo_id>', methods=['POST'])
def eliminar_tiempo(tiempo_id):
    conn = conectar_bd()
    conn.execute("DELETE FROM tiempos_carreras WHERE id = ?", (tiempo_id,))
    conn.commit()
    return jsonify({"success": True})

# --- NUEVO: RUTAS DE CONTROL DE ARENA (TIEMPO REAL) ---

@app.route('/api/arena/estado/<categoria>', methods=['GET'])
def estado_arena(categoria):
    conn = conectar_bd()
    arena = conn.execute("SELECT * FROM arena_activa WHERE categoria_tag = ?", (categoria,)).fetchone()
    conn.close()
    
    if not arena:
        return jsonify({"estado": "inactivo"})
        
    return jsonify({
        "estado": arena['estado'],
        "robot1": arena['robot1'],
        "robot2": arena['robot2'],
        "tiempo_inicio": arena['tiempo_inicio']
    })

@app.route('/api/admin/arena/iniciar', methods=['POST'])
def iniciar_arena():
    data = request.get_json()
    cat = data.get('categoria')
    r1 = data.get('robot1')
    r2 = data.get('robot2')
    
    conn = conectar_bd()
    conn.execute('''INSERT OR REPLACE INTO arena_activa (categoria_tag, robot1, robot2, tiempo_inicio, estado) 
                    VALUES (?, ?, ?, ?, 'peleando')''', (cat, r1, r2, time.time()))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "¡COMBATE INICIADO!"})

@app.route('/api/admin/arena/ko', methods=['POST'])
def ko_arena():
    data = request.get_json()
    cat = data.get('categoria')
    
    conn = conectar_bd()
    conn.execute("UPDATE arena_activa SET estado = 'ko' WHERE categoria_tag = ?", (cat,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/juez/enviar_veredicto', methods=['POST'])
def guardar_veredicto():
    data = request.get_json()
    # Aquí procesaremos la suma de puntos en la Fase 3
    return jsonify({"success": True, "message": "Veredicto guardado."})

@app.route('/publico')
def ver_publico(): return render_template('pantalla_publico.html')

@app.route('/brackets')
def ver_brackets(): return render_template('brackets.html')

if __name__ == '__main__':
    inicializar_bd()
    app.run(debug=True, host='0.0.0.0', port=5000)