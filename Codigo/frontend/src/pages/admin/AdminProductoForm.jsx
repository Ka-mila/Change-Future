import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminNav from '../../components/admin/AdminNav.jsx';
import Campo from '../../components/Campo.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';

const PERSONALIZACION = ['Disponible', 'Personalizable', 'A medida', 'No disponible'];
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;
const vacio = { nombre: '', categoria: '', precio: '', stock: '0', descripcion: '', material: 'PLA', personalizacion: 'Disponible', destacado: false };

function validar(datos) {
    const precio = Number(String(datos.precio).replace(/\./g, ''));
    const stock = Number(datos.stock);
    const errores = {
        nombre: datos.nombre.trim() ? '' : 'El nombre es obligatorio',
        categoria: datos.categoria.trim() ? '' : 'La categoría es obligatoria',
        descripcion: datos.descripcion.trim() ? '' : 'La descripción es obligatoria',
        precio: Number.isInteger(precio) && precio > 0 ? '' : 'El precio debe ser un número entero mayor que 0',
        stock: datos.stock === '' || (Number.isInteger(stock) && stock >= 0) ? '' : 'El stock debe ser un número entero (0 o más)'
    };
    return Object.fromEntries(Object.entries(errores).filter(([, mensaje]) => mensaje));
}

// HU06.1 Agregar producto · HU06.2 Modificar producto
export default function AdminProductoForm() {
    const { id } = useParams();
    const editando = Boolean(id);
    const navigate = useNavigate();
    const showToast = useToast();
    const [datos, setDatos] = useState(vacio);
    const [categorias, setCategorias] = useState([]);
    const [imagenActual, setImagenActual] = useState('/assets/images/product-placeholder.svg');
    const [archivo, setArchivo] = useState(null);
    const [vistaPrevia, setVistaPrevia] = useState('');
    const [errores, setErrores] = useState({});
    const [mensaje, setMensaje] = useState('');
    const [cargando, setCargando] = useState(editando);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        api.productosAdmin()
            .then((lista) => setCategorias([...new Set(lista.map((p) => p.categoria))].sort()))
            .catch(() => {});
        if (!editando) return;
        api.productoAdmin(id)
            .then((p) => {
                setDatos({
                    nombre: p.nombre, categoria: p.categoria, precio: String(p.precio), stock: String(p.stock),
                    descripcion: p.descripcion || '', material: p.material || 'PLA',
                    personalizacion: p.personalizacion || 'Disponible', destacado: p.destacado
                });
                setImagenActual(p.imagen);
            })
            .catch((e) => setMensaje(e.message))
            .finally(() => setCargando(false));
    }, [id, editando]);

    useEffect(() => () => vistaPrevia && URL.revokeObjectURL(vistaPrevia), [vistaPrevia]);

    function cambiar(event) {
        const { name, value, type, checked } = event.target;
        setDatos((actual) => ({ ...actual, [name]: type === 'checkbox' ? checked : value }));
        setErrores((actual) => ({ ...actual, [name]: '' }));
    }

    function elegirImagen(event) {
        const elegido = event.target.files[0];
        event.target.value = '';
        if (!elegido) return;
        if (!TIPOS_IMAGEN.includes(elegido.type)) {
            setErrores((actual) => ({ ...actual, imagen: 'Formato no permitido. Usa una imagen JPG, PNG o WEBP.' }));
            return;
        }
        if (elegido.size > MAX_MB * 1024 * 1024) {
            setErrores((actual) => ({ ...actual, imagen: `La imagen pesa más de ${MAX_MB} MB.` }));
            return;
        }
        setErrores((actual) => ({ ...actual, imagen: '' }));
        setArchivo(elegido);
        setVistaPrevia(URL.createObjectURL(elegido));
    }

    async function guardar(event) {
        event.preventDefault();
        const encontrados = validar(datos);
        setErrores(encontrados);
        setMensaje('');
        if (Object.keys(encontrados).length) return;

        const formulario = new FormData();
        Object.entries(datos).forEach(([clave, valor]) => formulario.append(clave, valor));
        if (archivo) formulario.append('imagen', archivo);

        setGuardando(true);
        try {
            const producto = editando ? await api.modificarProducto(id, formulario) : await api.crearProducto(formulario);
            showToast(editando ? 'Cambios guardados. Ya se ven en el catálogo.' : `"${producto.nombre}" ya está en el catálogo.`);
            navigate('/admin/productos');
        } catch (e) {
            setErrores(e.campos || {});
            setMensaje(e.message);
            setGuardando(false);
        }
    }

    const campo = (nombre) => ({ id: nombre, value: datos[nombre], onChange: cambiar, error: errores[nombre] });

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">ADMINISTRACIÓN · PRODUCTOS</div>
                <div className="section-heading">
                    <h1>{editando ? 'Editar producto' : 'Nuevo producto'}</h1>
                    <AdminNav />
                </div>
                <p style={{ margin: '-12px 0 18px' }}><Link className="text-link" to="/admin/productos">← Volver a productos</Link></p>

                {cargando ? <p className="muted">Cargando…</p> : (
                    <form className="producto-form" onSubmit={guardar} noValidate>
                        <section className="form-panel login-panel">
                            <Campo {...campo('nombre')} label="Nombre *" maxLength={120} placeholder="Ej.: Lámpara luna" />
                            <div className="form-row">
                                <Campo {...campo('categoria')} label="Categoría *" list="categorias" maxLength={60}
                                    placeholder="Elige o escribe una nueva" hint="Si escribes una categoría nueva, se crea automáticamente." />
                                <datalist id="categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
                                <Campo {...campo('precio')} label="Precio (CLP) *" inputMode="numeric" placeholder="12990" />
                            </div>
                            <div className="form-row">
                                <Campo {...campo('stock')} label="Stock" inputMode="numeric" />
                                <Campo {...campo('material')} label="Material" maxLength={40} />
                            </div>
                            <label className="form-label" htmlFor="descripcion">Descripción *</label>
                            <textarea id="descripcion" name="descripcion" className={`field${errores.descripcion ? ' invalid' : ''}`}
                                maxLength={1000} value={datos.descripcion} onChange={cambiar} placeholder="Cuéntale al cliente qué es y para qué sirve" />
                            {errores.descripcion && <p className="field-error">{errores.descripcion}</p>}

                            <label className="form-label" htmlFor="personalizacion">Personalización</label>
                            <select id="personalizacion" name="personalizacion" className="field" value={datos.personalizacion} onChange={cambiar}>
                                {PERSONALIZACION.map((opcion) => <option key={opcion}>{opcion}</option>)}
                            </select>
                            <label className="muted" style={{ display: 'flex', gap: 9, marginTop: 16, fontSize: 12 }}>
                                <input type="checkbox" name="destacado" checked={datos.destacado} onChange={cambiar} style={{ accentColor: 'var(--lime)' }} />
                                Mostrar en "Productos destacados" del inicio
                            </label>

                            {mensaje && <p className="notice error" role="alert">{mensaje}</p>}
                            <div className="perfil-actions">
                                <button className="btn" type="submit" disabled={guardando}>
                                    {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar al catálogo'}
                                </button>
                                <Link className="btn secondary" to="/admin/productos">Cancelar</Link>
                            </div>
                        </section>

                        <aside className="form-panel login-panel">
                            <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Imagen</h2>
                            <div className="producto-imagen">
                                <img src={vistaPrevia || imagenActual} alt="Vista previa del producto" />
                            </div>
                            <label className="upload" htmlFor="imagen" style={{ marginTop: 12, display: 'block' }}>
                                <strong>＋ {archivo || editando ? 'Cambiar imagen' : 'Elegir imagen'}</strong>
                                JPG, PNG o WEBP · hasta {MAX_MB} MB
                                <input type="file" id="imagen" accept={TIPOS_IMAGEN.join(',')} onChange={elegirImagen} />
                            </label>
                            {errores.imagen && <p className="field-error" role="alert">{errores.imagen}</p>}
                            {!archivo && !editando && <p className="field-hint">Si no eliges una, se usa una imagen provisional.</p>}
                        </aside>
                    </form>
                )}
            </div>
        </main>
    );
}
