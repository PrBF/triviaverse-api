// Função para proteger rotas confidenciais no Express, lendo o token diretamente do cookie.

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const verificarToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
  }

  try {
    const decodificado = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decodificado; // Injeta os dados decodificados na requisição
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token inválido ou expirado.' });
  }
};

// Exemplo de rota protegida
// app.get('/api/dashboard', verificarToken, (req, res) => {
//   res.json({ dados: "Informações secretas do backend" });
// });