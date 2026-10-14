import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <Link to="/" className="brand">TaskFlow</Link>
      {user && (
        <div className="nav-right">
          <span>{user.name} <span className="badge">{user.role}</span></span>
          <button className="btn btn-small" onClick={handleLogout}>Log out</button>
        </div>
      )}
    </header>
  );
}
