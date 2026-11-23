"""Microservicio de procesamiento de imágenes: genera la propuesta 3D (STL).

Es un servicio interno: lo llama el servicio de personalización, no el navegador.
"""
import os

from flask import Flask, Response, jsonify, request

from generador import ErrorProcesamiento, generar_modelo


def create_app():
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB

    @app.get('/health')
    def health():
        return jsonify(status='ok')

    @app.post('/procesar')
    def procesar():
        archivo = request.files.get('imagen')
        if not archivo:
            return jsonify(error='Falta la imagen'), 400
        try:
            stl, medidas = generar_modelo(archivo.read(), request.form.get('estilo', 'silueta'))
        except ErrorProcesamiento as e:
            return jsonify(error=str(e)), 422

        headers = {f'X-{clave.replace("_", "-")}': str(valor) for clave, valor in medidas.items()}
        return Response(stl, mimetype='model/stl', headers=headers)

    return app


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5005)), debug=True)
