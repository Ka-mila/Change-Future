import { Route, Routes } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import Inicio from './pages/Inicio.jsx';
import Catalogo from './pages/Catalogo.jsx';
import Producto from './pages/Producto.jsx';
import Carrito from './pages/Carrito.jsx';
import CreaDesdeCero from './pages/CreaDesdeCero.jsx';
import Nosotros from './pages/Nosotros.jsx';
import Login from './pages/Login.jsx';

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
                <Route path="/crea-desde-cero" element={<CreaDesdeCero />} />
                <Route path="/nosotros" element={<Nosotros />} />
                <Route path="/login" element={<Login />} />
            </Routes>
            <Footer />
        </>
    );
}
