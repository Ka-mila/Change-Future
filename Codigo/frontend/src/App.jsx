import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import RutaPrivada from './components/RutaPrivada.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import Inicio from './pages/Inicio.jsx';
import Catalogo from './pages/Catalogo.jsx';
import Producto from './pages/Producto.jsx';
import Carrito from './pages/Carrito.jsx';
import Nosotros from './pages/Nosotros.jsx';
import Login from './pages/Login.jsx';
import Perfil from './pages/Perfil.jsx';
import RecuperarContrasena from './pages/RecuperarContrasena.jsx';
import RestablecerContrasena from './pages/RestablecerContrasena.jsx';
import MisPedidos from './pages/MisPedidos.jsx';
import MiPedido from './pages/MiPedido.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminPedidos from './pages/admin/AdminPedidos.jsx';
import AdminPedido from './pages/admin/AdminPedido.jsx';
import AdminProductos from './pages/admin/AdminProductos.jsx';
import AdminProductoForm from './pages/admin/AdminProductoForm.jsx';
import AdminClientes from './pages/admin/AdminClientes.jsx';
import AdminCliente from './pages/admin/AdminCliente.jsx';
import AdminSolicitudes from './pages/admin/AdminSolicitudes.jsx';

// La librería 3D es pesada: esta página se descarga solo cuando alguien la abre.
const CreaDesdeCero = lazy(() => import('./pages/CreaDesdeCero.jsx'));
const AdminSolicitud = lazy(() => import('./pages/admin/AdminSolicitud.jsx'));
const cargando = <main className="section"><div className="wrap"><p className="muted">Cargando…</p></div></main>;

export default function App() {
    return (
        <>
            <ScrollToTop />
            <Header />
            <Routes>
                <Route path="/" element={<Inicio />} />
                <Route path="/catalogo" element={<Catalogo />} />
                <Route path="/producto/:id" element={<Producto />} />
                <Route path="/carrito" element={<Carrito />} />
                <Route path="/crea-desde-cero" element={<Suspense fallback={cargando}><CreaDesdeCero /></Suspense>} />
                <Route path="/nosotros" element={<Nosotros />} />
                <Route path="/login" element={<Login />} />
                <Route path="/recuperar" element={<RecuperarContrasena />} />
                <Route path="/restablecer" element={<RestablecerContrasena />} />
                <Route path="/perfil" element={<RutaPrivada><Perfil /></RutaPrivada>} />
                <Route path="/mis-pedidos" element={<RutaPrivada><MisPedidos /></RutaPrivada>} />
                <Route path="/mis-pedidos/:id" element={<RutaPrivada><MiPedido /></RutaPrivada>} />
                <Route path="/admin" element={<RutaPrivada rol="administrador"><AdminDashboard /></RutaPrivada>} />
                <Route path="/admin/pedidos" element={<RutaPrivada rol="administrador"><AdminPedidos /></RutaPrivada>} />
                <Route path="/admin/pedidos/:id" element={<RutaPrivada rol="administrador"><AdminPedido /></RutaPrivada>} />
                <Route path="/admin/productos" element={<RutaPrivada rol="administrador"><AdminProductos /></RutaPrivada>} />
                <Route path="/admin/productos/nuevo" element={<RutaPrivada rol="administrador"><AdminProductoForm /></RutaPrivada>} />
                <Route path="/admin/productos/:id" element={<RutaPrivada rol="administrador"><AdminProductoForm /></RutaPrivada>} />
                <Route path="/admin/clientes" element={<RutaPrivada rol="administrador"><AdminClientes /></RutaPrivada>} />
                <Route path="/admin/clientes/:id" element={<RutaPrivada rol="administrador"><AdminCliente /></RutaPrivada>} />
                <Route path="/admin/solicitudes" element={<RutaPrivada rol="administrador"><AdminSolicitudes /></RutaPrivada>} />
                <Route path="/admin/solicitudes/:codigo" element={
                    <RutaPrivada rol="administrador"><Suspense fallback={cargando}><AdminSolicitud /></Suspense></RutaPrivada>
                } />
            </Routes>
            <Footer />
        </>
    );
}
