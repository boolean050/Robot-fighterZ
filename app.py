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
    
    # 2. Tabla de categorías (Códigos de los jueces reales)
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
    data = request.get_json()
    nombre = data.get('nombre')
    codigo = data.get('codigo')
    categoria_solicitada = data.get('categoria')  # Recibimos el nombre de la categoría del formulario (ej: "1 lb")

    # 1. Caso especial: Filtro Master (Tú)
    if codigo == CODIGO_ADMIN:
        # Retornamos el estado actual del registro para que el JS sepa cómo pintar el switch
        conn = conectar_bd()
        cursor = conn.cursor()
        cursor.execute("SELECT registro_abierto FROM configuracion WHERE id = 1")
        estado_registro = cursor.fetchone()['registro_abierto']
        conn.close()
        return jsonify({"role": "admin", "estado_registro": estado_registro})

    conn = conectar_bd()
    cursor = conn.cursor()

    # 2. Verificar primero si el estado de registros está abierto en la configuración
    cursor.execute("SELECT registro_abierto FROM configuracion WHERE id = 1")
    if cursor.fetchone()['registro_abierto'] == 0:
        conn.close()
        return jsonify({"success": False, "message": "❌ Los registros están cerrados por el Administrador."}), 403

    # 3. Traer los datos de la categoría solicitada basándonos en su nombre
    cursor.execute("SELECT id, codigo FROM categorias WHERE nombre = ?", (categoria_solicitada,))
    cat_info = cursor.fetchone()
    
    if not cat_info:
        conn.close()
        return jsonify({"success": False, "message": "❌ La categoría seleccionada no es válida."}), 400
    
    cat_id = cat_info['id']
    codigo_correcto_cat = cat_info['codigo']

    # 4. Validar que el código que metió el juez sea el correcto para esa categoría
    if codigo != codigo_correcto_cat:
        conn.close()
        return jsonify({"success": False, "message": f"❌ Código de acceso incorrecto para la categoría {categoria_solicitada}."}), 401

    # 5. REGLA DE ORO: Buscar si este juez ya se registró previamente en OTRA categoría
    cursor.execute('''
        SELECT categorias.nombre 
        FROM jueces 
        JOIN categorias ON jueces.categoria_id = categorias.id 
        WHERE jueces.nombre = ?
    ''', (nombre,))
    juez_existente = cursor.fetchone()

    if juez_existente:
        categoria_registrada = juez_existente['nombre']
        
        # Si ya existe pero quiere meterse a una categoría diferente, lo rebotamos
        if categoria_registrada != categoria_solicitada:
            conn.close()
            return jsonify({
                "success": False, 
                "message": f"❌ Acceso denegado. Este juez ya está asignado exclusivamente a la categoría: {categoria_registrada}."
            }), 403
            
        conn.close()
        return jsonify({"success": True, "nombre": nombre, "categoria": categoria_registrada})
    
    # 6. Si es un juez limpio que apenas se registra a su categoría correspondiente por primera vez
    cursor.execute("INSERT INTO jueces (nombre, categoria_id) VALUES (?, ?)", (nombre, cat_id))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "nombre": nombre, "categoria": categoria_solicitada})


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


# --- NUEVOS ENDPOINTS DE ADMINISTRACIÓN MAESTRA ---

@app.route('/api/admin/jueces', methods=['GET'])
def obtener_jueces():
    """Retorna la lista de todos los jueces registrados con el nombre de su categoría"""
    conn = conectar_bd()
    cursor = conn.cursor()
    
    # Traemos el ID del juez, su nombre y el nombre de su categoría asociada usando un INNER JOIN
    cursor.execute('''
        SELECT jueces.id, jueces.nombre, categorias.nombre AS categoria 
        FROM jueces
        JOIN categorias ON jueces.categoria_id = categorias.id
        ORDER BY categorias.nombre ASC, jueces.nombre ASC
    ''')
    
    # row_factory=sqlite3.Row nos permite convertir cada fila a un diccionario nativo de Python directamente
    jueces = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({"success": True, "jueces": jueces})


@app.route('/api/admin/eliminar_juez/<int:juez_id>', methods=['POST'])
def eliminar_juez(juez_id):
    """Elimina un juez de la base de datos por su ID para permitirle re-registrarse"""
    conn = conectar_bd()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM jueces WHERE id = ?", (juez_id,))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "message": "Juez eliminado correctamente de la base de datos."})


#Se agrega la direccion en la que se proyectará el dashboard con los cambios en tiempo real 
@app.route('/publico')
def ver_publico():
    """Ruta oficial para proyectar el tablero en el auditorio"""
    return render_template('pantalla_publico.html')


if __name__ == '__main__':
    inicializar_bd()  # Se ejecuta la base de datos antes de arrancar el server
    #app.run(debug=True, port=5000)
    # Agregamos host='0.0.0.0' para abrir el servidor a la red local
    app.run(debug=True, host='0.0.0.0', port=5000)