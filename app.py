from flask import Flask, render_template, request, jsonify
import sqlite3
import os
app = Flask(__name__, static_folder='static', template_folder='templates')

# Configuración del proyecto
DATABASE = 'torneo_robots.db'
CODIGO_ADMIN = "9999"  # Tu pin secreto maestro

def conectar_bd():
    """Función para conectarse a la base de datos SQLite y retornar diccionarios"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row  # Permite acceder a las columnas por nombre
    return conn

def inicializar_bd():
    """Crea las tablas necesarias y el switch de seguridad si no existen"""
    conn = conectar_bd()
    cursor = conn.cursor()
    
    # 1. Tabla de configuración (El candado para los colados)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS configuracion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            registro_abierto INTEGER DEFAULT 1
        )
    ''')
    
    # Asegurar que exista la fila de configuración inicial
    cursor.execute("SELECT COUNT(*) FROM configuracion")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO configuracion (registro_abierto) VALUES (1)")
    
    # 2. Tabla de categorías (Para simular los códigos de los jueces reales)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT UNIQUE,
            nombre TEXT
        )
    ''')
    
    # Insertar categorías por defecto si la tabla está vacía
    cursor.execute("SELECT COUNT(*) FROM categorias")
    if cursor.fetchone()[0] == 0:
        codigos_iniciales = [
            ("1111", "Mini Sumos"),
            ("2222", "1 lb"),
            ("3333", "3 lb"),
            ("4444", "Autónomos"),
            ("5555", "Humanoides")
        ]
        cursor.executemany("INSERT INTO categorias (codigo, nombre) VALUES (?, ?)", codigos_iniciales)

    # 3. Tabla de Jueces registrados
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jueces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT,
            categoria_id INTEGER,
            FOREIGN KEY(categoria_id) REFERENCES categorias(id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("🔋 Base de datos SQLite inicializada correctamente.")

# --- RUTAS DEL SERVIDOR ---

@app.route('/')
def home():
    """Ruta principal que renderiza tu HTML de portal_jueces"""
    return render_template('portal_jueces.html')


@app.route('/api/login_juez', methods=['POST'])
def login_juez():
    datos = request.get_json()
    nombre = datos.get('nombre')
    codigo = datos.get('codigo')

    conn = conectar_bd()
    cursor = conn.cursor()

    # 1. CASO ADMINISTRADOR: Si metes tu código maestro
    if codigo == CODIGO_ADMIN:
        cursor.execute("SELECT registro_abierto FROM configuracion WHERE id = 1")
        estado = cursor.fetchone()['registro_abierto']
        conn.close()
        return jsonify({"success": True, "role": "admin", "estado_registro": estado})

    # 2. VALIDAR SI EL REGISTRO ESTÁ BLOQUEADO POR EL ADMIN
    cursor.execute("SELECT registro_abierto FROM configuracion WHERE id = 1")
    if cursor.fetchone()['registro_abierto'] == 0:
        conn.close()
        return jsonify({"success": False, "message": "❌ Acceso denegado. Los registros están temporalmente cerrados."}), 403

    # 3. CASO JUEZ NORMAL
    cursor.execute("SELECT * FROM categorias WHERE codigo = ?", (codigo,))
    categoria = cursor.fetchone()

    if categoria:
        cursor.execute("INSERT INTO jueces (nombre, categoria_id) VALUES (?, ?)", (nombre, categoria['id']))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "role": "juez", "nombre": nombre, "categoria": categoria['nombre']})
    
    conn.close()
    return jsonify({"success": False, "message": "❌ Código inválido. Verifica con el administrador."}), 401


@app.route('/api/admin/toggle_registro', methods=['POST'])
def toggle_registro():
    conn = conectar_bd()
    cursor = conn.cursor()
    
    cursor.execute("SELECT registro_abierto FROM configuracion WHERE id = 1")
    estado_actual = cursor.fetchone()['registro_abierto']
    
    # Invertimos el bit (si es 1 pasa a 0, si es 0 pasa a 1)
    nuevo_estado = 0 if estado_actual == 1 else 1
    
    cursor.execute("UPDATE configuracion SET registro_abierto = ? WHERE id = 1", (nuevo_estado,))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "nuevo_estado": nuevo_estado})


if __name__ == '__main__':
    inicializar_bd()  # Se ejecuta la base de datos antes de arrancar el server
    app.run(debug=True, port=5000)