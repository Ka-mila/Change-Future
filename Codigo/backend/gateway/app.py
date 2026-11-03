"""API Gateway de Change Future.

Único punto de entrada para el frontend. Recibe /api/<servicio>/<ruta>
y reenvía la petición al microservicio correspondiente.
"""
import os

import requests
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

SERVICES = {
    'usuarios': os.getenv('USUARIOS_URL', 'http://127.0.0.1:5001'),
    'catalogo': os.getenv('CATALOGO_URL', 'http://127.0.0.1:5002'),
    'pedidos': os.getenv('PEDIDOS_URL', 'http://127.0.0.1:5003'),
    'personalizacion': os.getenv('PERSONALIZACION_URL', 'http://127.0.0.1:5004'),
}

# Cabeceras que no deben copiarse entre la petición original y la reenviada.
HOP_HEADERS = {'host', 'content-length', 'connection', 'transfer-encoding', 'content-encoding'}

app = Flask(__name__)
CORS(app, origins=os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(','))


@app.get('/api/health')
def health():
    status = {}
    for name, url in SERVICES.items():
        try:
            ok = requests.get(f'{url}/health', timeout=2).ok
        except requests.RequestException:
            ok = False
        status[name] = 'ok' if ok else 'caído'
    return jsonify(gateway='ok', servicios=status)


@app.route('/api/<service>/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
@app.route('/api/<service>/<path:path>', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
def proxy(service, path):
    base_url = SERVICES.get(service)
    if not base_url:
        return jsonify(error=f'Servicio "{service}" no existe'), 404

    headers = {k: v for k, v in request.headers if k.lower() not in HOP_HEADERS}
    try:
        upstream = requests.request(
            method=request.method,
            url=f'{base_url}/{path}',
            params=request.args,
            data=request.get_data(),
            headers=headers,
            timeout=10,
        )
    except requests.RequestException:
        return jsonify(error=f'El servicio "{service}" no responde'), 503

    response_headers = [
        (k, v) for k, v in upstream.headers.items() if k.lower() not in HOP_HEADERS
    ]
    return Response(upstream.content, upstream.status_code, response_headers)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)), debug=True)
