from validaciones import normalizar_rut


# HU01.1 Registro
def test_registro_exitoso_confirma_creacion(client, datos_validos):
    respuesta = client.post('/registro', json=datos_validos)
    data = respuesta.get_json()
    assert respuesta.status_code == 201
    assert data['mensaje'] == '¡Tu cuenta fue creada con éxito!'
    assert data['usuario']['rut'] == '12345678-5'
    assert data['usuario']['apellido'] == 'Morales'


def test_registro_campos_obligatorios(client):
    respuesta = client.post('/registro', json={})
    campos = respuesta.get_json()['campos']
    assert respuesta.status_code == 400
    assert set(campos) == {'nombre', 'apellido', 'correo', 'rut', 'contrasena'}


def test_registro_correo_formato_invalido(client, datos_validos):
    respuesta = client.post('/registro', json={**datos_validos, 'correo': 'no-es-correo'})
    assert respuesta.status_code == 400
    assert 'correo' in respuesta.get_json()['campos']


def test_registro_rut_invalido(client, datos_validos):
    respuesta = client.post('/registro', json={**datos_validos, 'rut': '12.345.678-9'})
    assert respuesta.status_code == 400
    assert 'rut' in respuesta.get_json()['campos']


def test_registro_contrasena_debil(client, datos_validos):
    respuesta = client.post('/registro', json={**datos_validos, 'contrasena': 'solotexto'})
    assert 'contrasena' in respuesta.get_json()['campos']


def test_registro_correo_duplicado(client, datos_validos):
    client.post('/registro', json=datos_validos)
    respuesta = client.post('/registro', json={**datos_validos, 'rut': '11.111.111-1', 'correo': 'CONSTANZA@ejemplo.cl'})
    assert respuesta.status_code == 409
    assert 'correo' in respuesta.get_json()['campos']


def test_registro_rut_duplicado(client, datos_validos):
    client.post('/registro', json=datos_validos)
    respuesta = client.post('/registro', json={**datos_validos, 'correo': 'otra@ejemplo.cl', 'rut': '123456785'})
    assert respuesta.status_code == 409
    assert 'rut' in respuesta.get_json()['campos']


# HU01.2 Inicio de sesión
def test_login_correcto(client, datos_validos, registrado):
    respuesta = client.post('/login', json={'correo': datos_validos['correo'], 'contrasena': 'clave1234'})
    assert respuesta.status_code == 200
    assert 'token' in respuesta.get_json()


def test_login_incorrecto(client, datos_validos, registrado):
    respuesta = client.post('/login', json={'correo': datos_validos['correo'], 'contrasena': 'otra12345'})
    assert respuesta.status_code == 401
    assert respuesta.get_json()['error'] == 'Correo o contraseña incorrectos'


def test_login_sin_datos(client):
    assert client.post('/login', json={}).status_code == 400


# HU01.3 Sin sesión no hay acceso a lo privado
def test_perfil_sin_sesion(client):
    assert client.get('/perfil').status_code == 401
    assert client.get('/perfil', headers={'Authorization': 'Bearer token-falso'}).status_code == 401


# HU01.4 Gestionar datos personales
def test_consultar_perfil(client, registrado):
    data = client.get('/perfil', headers=registrado).get_json()
    assert data['correo'] == 'constanza@ejemplo.cl'
    assert data['rut'] == '12345678-5'


def test_modificar_perfil(client, registrado):
    respuesta = client.put('/perfil', headers=registrado,
                           json={'nombre': 'Coni', 'apellido': 'Morales B', 'telefono': '+56 9 8765 4321',
                                 'correo': 'cambio@ejemplo.cl', 'rut': '11.111.111-1'})
    assert respuesta.status_code == 200
    data = client.get('/perfil', headers=registrado).get_json()
    assert (data['nombre'], data['apellido'], data['telefono']) == ('Coni', 'Morales B', '+56 9 8765 4321')
    # El correo y el RUT no se pueden cambiar
    assert (data['correo'], data['rut']) == ('constanza@ejemplo.cl', '12345678-5')


def test_modificar_perfil_valida_datos(client, registrado):
    respuesta = client.put('/perfil', headers=registrado, json={'nombre': '', 'apellido': 'X', 'telefono': 'abc'})
    assert respuesta.status_code == 400
    assert set(respuesta.get_json()['campos']) == {'nombre', 'telefono'}


def test_cambiar_contrasena(client, datos_validos, registrado):
    malo = client.put('/perfil/contrasena', headers=registrado, json={'actual': 'mala1234', 'nueva': 'nueva1234'})
    assert malo.status_code == 400
    ok = client.put('/perfil/contrasena', headers=registrado, json={'actual': 'clave1234', 'nueva': 'nueva1234'})
    assert ok.status_code == 200
    assert client.post('/login', json={'correo': datos_validos['correo'], 'contrasena': 'nueva1234'}).status_code == 200


# HU01.5 Recuperar contraseña
def test_recuperar_y_restablecer(client, datos_validos, registrado, monkeypatch):
    from conftest import servicio
    enviados = []
    monkeypatch.setattr(servicio, 'correo_configurado', lambda: True)
    monkeypatch.setattr(servicio, 'enviar_enlace_recuperacion',
                        lambda correo, nombre, enlace: enviados.append(enlace))
    respuesta = client.post('/recuperar', json={'correo': datos_validos['correo']})
    assert respuesta.status_code == 200
    token = enviados[0].split('token=', 1)[1]

    debil = client.post('/restablecer', json={'token': token, 'contrasena': 'corta'})
    assert debil.status_code == 400

    ok = client.post('/restablecer', json={'token': token, 'contrasena': 'nueva1234'})
    assert ok.status_code == 200
    assert client.post('/login', json={'correo': datos_validos['correo'], 'contrasena': 'nueva1234'}).status_code == 200

    # El enlace es de un solo uso
    otra_vez = client.post('/restablecer', json={'token': token, 'contrasena': 'otra12345'})
    assert otra_vez.status_code == 400


def test_recuperar_no_revela_si_el_correo_existe(client, datos_validos, registrado):
    existe = client.post('/recuperar', json={'correo': datos_validos['correo']}).get_json()
    no_existe = client.post('/recuperar', json={'correo': 'nadie@ejemplo.cl'}).get_json()
    assert existe == no_existe


def test_restablecer_token_invalido(client):
    assert client.post('/restablecer', json={'token': 'inventado', 'contrasena': 'nueva1234'}).status_code == 400


def test_normalizar_rut():
    assert normalizar_rut('12.345.678-5') == '12345678-5'
    assert normalizar_rut('7.654.321-6') == '7654321-6'
    assert normalizar_rut('12345678-9') is None
    assert normalizar_rut('abc') is None


# HU06.4 Consultar clientes
def test_admin_consulta_clientes(client, datos_validos, registrado):
    from conftest import servicio
    otro = {**datos_validos, 'correo': 'otra@ejemplo.cl', 'rut': '11.111.111-1', 'nombre': 'Camila', 'apellido': 'Zúñiga'}
    client.post('/registro', json=otro)
    assert client.get('/clientes', headers=registrado).status_code == 403  # un cliente no puede

    with client.application.app_context():
        usuario = servicio.Usuario.query.filter_by(correo='constanza@ejemplo.cl').first()
        usuario.rol = servicio.Rol.query.filter_by(nombre_rol='administrador').first()
        servicio.db.session.commit()
        admin = {'Authorization': f'Bearer {servicio.create_token(usuario)}'}
        id_camila = servicio.Usuario.query.filter_by(correo='otra@ejemplo.cl').first().id_usuario

    clientes = client.get('/clientes', headers=admin).get_json()
    assert [c['correo'] for c in clientes] == ['otra@ejemplo.cl']  # los administradores no aparecen
    assert {'nombre', 'apellido', 'rut', 'telefono', 'fecha_registro'} <= set(clientes[0])
    assert client.get('/clientes?q=11111111-1', headers=admin).get_json()[0]['nombre'] == 'Camila'
    assert client.get('/clientes?q=zúñiga', headers=admin).get_json()[0]['nombre'] == 'Camila'
    assert client.get(f'/clientes/{id_camila}', headers=admin).get_json()['rut'] == '11111111-1'
