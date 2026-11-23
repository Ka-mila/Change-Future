import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Los modelos llegan con su lado más largo en 100 mm (ver servicio-procesamiento).
const LADO_BASE_MM = 100;

/**
 * Muestra un modelo STL que se puede girar y acercar.
 * - url: dirección del STL
 * - color: color del material ('#a347db')
 * - medidaMm: lado más largo con el tamaño elegido; ancho y alto se escalan, el grosor no
 * - suave: suaviza la superficie (para el estilo relieve)
 */
export default function Visor3D({ url, color = '#a347db', medidaMm = LADO_BASE_MM, suave = false }) {
    const contenedor = useRef(null);
    const escena = useRef(null);
    const [estado, setEstado] = useState('cargando');

    // Escena, cámara y controles: se crean una sola vez
    useEffect(() => {
        const nodo = contenedor.current;
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch {
            setEstado('sin-webgl');
            return undefined;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        nodo.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, 1, 3000);
        // Vista de tres cuartos: así se aprecia el grosor y el relieve
        camera.position.set(150, 130, 290);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 50, 0);
        controls.enableDamping = true;
        controls.minDistance = 80;
        controls.maxDistance = 700;
        controls.update();

        scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2540, 1.6));
        const luz = new THREE.DirectionalLight(0xffffff, 2.2);
        luz.position.set(140, 220, 260);
        scene.add(luz);
        const contraluz = new THREE.DirectionalLight(0xb48cff, 0.8);
        contraluz.position.set(-200, 80, -150);
        scene.add(contraluz);

        // Cuadrícula de 20 × 20 cm con líneas cada 1 cm, para dar idea del tamaño real
        const grilla = new THREE.GridHelper(200, 20, 0x8f86b3, 0x3b3656);
        scene.add(grilla);

        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
        const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
        scene.add(mesh);

        function ajustarTamano() {
            const { clientWidth: ancho, clientHeight: alto } = nodo;
            renderer.setSize(ancho, alto, false);
            camera.aspect = ancho / Math.max(alto, 1);
            camera.updateProjectionMatrix();
        }
        const observador = new ResizeObserver(ajustarTamano);
        observador.observe(nodo);
        ajustarTamano();

        let cuadro;
        function animar() {
            controls.update();
            renderer.render(scene, camera);
            cuadro = requestAnimationFrame(animar);
        }
        animar();

        escena.current = { mesh, material };
        return () => {
            cancelAnimationFrame(cuadro);
            observador.disconnect();
            controls.dispose();
            mesh.geometry.dispose();
            material.dispose();
            renderer.dispose();
            renderer.domElement.remove();
            escena.current = null;
        };
    }, []);

    // Cargar el modelo cada vez que cambia la dirección
    useEffect(() => {
        if (!url || !escena.current) return undefined;
        let cancelado = false;
        setEstado('cargando');

        fetch(url)
            .then((respuesta) => {
                if (!respuesta.ok) throw new Error('No se pudo descargar el modelo');
                return respuesta.arrayBuffer();
            })
            .then((datos) => {
                if (cancelado || !escena.current) return;
                let geometria = new STLLoader().parse(datos);
                if (suave) {
                    geometria.deleteAttribute('normal');
                    geometria = mergeVertices(geometria, 1e-3);
                }
                geometria.computeVertexNormals();
                geometria.center();

                const { mesh } = escena.current;
                mesh.geometry.dispose();
                mesh.geometry = geometria;
                setEstado('listo');
            })
            .catch(() => !cancelado && setEstado('error'));

        return () => { cancelado = true; };
    }, [url, suave]);

    // Color y tamaño se aplican sin volver a descargar el modelo
    useEffect(() => {
        escena.current?.material.color.set(color);
    }, [color]);

    useEffect(() => {
        const mesh = escena.current?.mesh;
        if (!mesh || estado !== 'listo') return;
        const escala = (medidaMm || LADO_BASE_MM) / LADO_BASE_MM;
        mesh.scale.set(escala, escala, 1);
        mesh.geometry.computeBoundingBox();
        // Apoyado sobre la cuadrícula
        mesh.position.y = -mesh.geometry.boundingBox.min.y * escala;
    }, [medidaMm, estado]);

    const mensajes = {
        cargando: 'Cargando modelo 3D…',
        error: 'No pudimos mostrar el modelo 3D. Intenta generar la propuesta otra vez.',
        'sin-webgl': 'Tu navegador no puede mostrar modelos 3D. Prueba con Chrome, Edge o Firefox actualizados.'
    };

    return (
        <div className="visor-3d">
            <div className="visor-3d-lienzo" ref={contenedor} />
            {estado !== 'listo' && <div className="visor-3d-aviso" role="status">{mensajes[estado]}</div>}
            {estado === 'listo' && <span className="visor-3d-ayuda">Arrastra para girar · rueda o pellizca para acercar</span>}
        </div>
    );
}
