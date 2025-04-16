import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow mb-8">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Link to="/" className="font-bold text-xl text-blue-600 hover:text-blue-800 transition-colors">Flash Cards</Link>
            <div className="space-x-4">
              <Link to="/" className="text-gray-700 hover:text-blue-600">Home</Link>
              <Link to="/admin" className="text-gray-700 hover:text-blue-600">Administrar</Link>
            </div>
          </div>
        </nav>
        <div className="container mx-auto px-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
