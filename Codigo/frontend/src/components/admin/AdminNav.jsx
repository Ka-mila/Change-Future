import { NavLink } from 'react-router-dom';

export default function AdminNav() {
    return (
        <nav className="admin-nav" aria-label="Administración">
            <NavLink to="/admin" end>Dashboard</NavLink>
            <NavLink to="/admin/pedidos">Pedidos</NavLink>
            <NavLink to="/admin/productos">Productos</NavLink>
            <NavLink to="/admin/clientes">Clientes</NavLink>
            <NavLink to="/admin/solicitudes">Solicitudes</NavLink>
        </nav>
    );
}
