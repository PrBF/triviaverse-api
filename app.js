import crypto from 'node:crypto';
if (!globalThis.crypto) {
    globalThis.crypto = crypto;
}

import express from 'express';
import cors from 'cors'
import xss from 'xss';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { verificarToken } from './authMiddleware.js';

dotenv.config(); // Carrega as variáveis de ambiente do arquivo .env

const app = express();
app.use(express.json()) //para receber dados por post
app.use(cookieParser());
// app.use(cors()) para permitir que nosso servidor seja acessivel por outros servidores 
// Configure o CORS para permitir credenciais (cookies) do frontend
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));
app.use(express.urlencoded({ extended: true }))

//O backend precisa validar os dados do usuário, gerar o token JWT e injetá-lo em um cookie criptografado de forma automática no navegador.
// npm install express jsonwebtoken cookie-parser cors dotenv bcryptjs
//Configurar o cookie como httpOnly para que ele fique invisível a scripts maliciosos no frontend.

//CONTROLE DE USUÁRIOS
import Usuario from './models/usuario.js';
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Busca o usuário pelo e-mail
        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
            return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
        }

        // 2. Utiliza o método auxiliar do bcrypt para verificar a senha
        const senhaCorreta = await usuario.compararSenha(password);
        if (!senhaCorreta) {
            return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
        }

        // 3. Se estiver tudo certo, gera o token JWT
        const token = jwt.sign(
            { userId: usuario._id, role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // 4. Envia o cookie HTTP-only
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000 //login dura 7 dias
        });

        // Retorna dados públicos do usuário para o front se achar necessário
        return res.status(200).json({
            message: 'Login efetuado com sucesso!',
            user: { id: usuario._id, nome: usuario.nome, email: usuario.email, nivel: usuario.nivel, vidas: usuario.vidas}
        });

    } catch (error) {
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
});

app.post('/logout', (req, res) => {
    // Limpa o cookie chamado 'token'
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
    });
    return res.status(200).json({ message: 'Logout efetuado com sucesso!' });
});

//Grava novo usuário
app.post('/usuarios', verificarToken, async (req, res) => {
    let { nome, email, senha } = req.body;
    nome = xss(nome)
    email = xss(email)

    try {
        // Verifica se o e-mail já está em uso
        const usuarioExiste = await Usuario.findOne({ email });
        if (usuarioExiste) {
            return res.status(400).json({ message: 'Este e-mail já está cadastrado.' });
        }

        // Cria o objeto do usuário (a senha aqui vai em texto limpo, o pre('save') vai interceptar)
        const novoUsuario = new Usuario({ nome, email, senha, nivel: 1, vidas: 5, cartas:[] });
        const usuarioCriado = await novoUsuario.save();
        const usuarioResponse = usuarioCriado.toObject();
        delete usuarioResponse.senha;

        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', usuario: usuarioResponse });
    } catch (error) {
        console.error("Erro no cadastro:", error);
        res.status(500).json({ message: 'Erro interno ao cadastrar usuário.' });
    }
})

//Retorna todos os usuários
app.get('/usuarios', verificarToken, async (req, res) => {
    try {
        // Busca todos os usuários e remove o campo 'senha' do retorno
        const usuarios = await Usuario.find({}).select('-senha');
        return res.status(200).json(usuarios);
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao buscar usuários.' });
    }
})

//Retorna um usuário específico
app.get('/usuarios/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Busca o usuário e remove o campo 'senha' do retorno
        const usuario = await Usuario.findById(id).select('-senha');
        return res.status(200).json(usuario);
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao buscar o usuário.' });
    }
})

//Altera nome e e-mail
app.patch('/usuarios/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    let { nome, email } = req.body;

    // Garante que os dados existem antes de aplicar o xss para evitar crash (TypeError)
    if (nome) nome = xss(nome);
    if (email) email = xss(email.toLowerCase()); // Força e-mail minúsculo para consistência

    try {
        //{ new: true } para retornar o usuário atualizado
        const usuarioAtualizado = await Usuario.findByIdAndUpdate(
            id,
            { nome, email },
            { runValidators: true, new: true }
        ).select('-senha'); // Oculta a senha por segurança

        if (!usuarioAtualizado) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        return res.status(200).json({
            message: 'Usuário atualizado com sucesso!',
            usuario: usuarioAtualizado
        });

    } catch (error) {
        // TRATAMENTO DE DUPLICIDADE: Caso o usuário tente mudar para um e-mail que já existe
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Este e-mail já está em uso por outro usuário.' });
        }

        console.error("Erro ao atualizar usuário:", error);
        return res.status(500).json({ message: 'Erro interno ao atualizar usuário.' });
    }
});

//Altera a senha
app.patch('/usuarios/:id/senha', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { senhaantiga, senhanova } = req.body;

    try {
        // 1. Busca o usuário pelo ID
        const usuario = await Usuario.findById(id);
        if (!usuario) {
            // Se o ID não existir, mudei para 404 (Não encontrado) para fazer mais sentido semântico
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // 2. Valida se a senha antiga está correta
        const senhaCorreta = await usuario.compararSenha(senhaantiga);
        if (!senhaCorreta) {
            return res.status(401).json({ message: 'Senha atual incorreta.' });
        }

        // 3. Aplica a nova senha diretamente no objeto do documento
        usuario.senha = senhanova;

        // 4. Salva o documento. Isso OBRIGATORIAMENTE dispara o pre('save') 
        // e criptografa a nova senha com bcrypt automaticamente!
        await usuario.save();

        // 5. Retorna status 200 (OK) já que estamos enviando uma mensagem no JSON
        return res.status(200).json({ message: 'Senha alterada com sucesso!' });

    } catch (error) {
        console.error("Erro ao alterar senha:", error);
        return res.status(500).json({ message: 'Erro interno ao alterar a senha.' });
    }
});

//Altera o progresso do usuário
app.patch('/usuarios/:id/progresso', verificarToken, async (req, res) => {
    const { id } = req.params;
    let { nivel, vidas } = req.body;

    if (nivel) nivel = xss(nivel);
    if (vidas) vidas = xss(vidas);

    try {
        //{ new: true } para retornar o usuário atualizado
        const usuarioAtualizado = await Usuario.findByIdAndUpdate(
            id,
            { nivel, vidas },
            { runValidators: true, new: true }
        ).select('-senha'); // Oculta a senha por segurança

        if (!usuarioAtualizado) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        return res.status(200).json({
            message: 'Usuário atualizado com sucesso!',
            usuario: usuarioAtualizado
        });

    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        return res.status(500).json({ message: 'Erro interno ao atualizar usuário.' });
    }
});
