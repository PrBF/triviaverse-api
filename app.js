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
            user: { id: usuario._id, nome: usuario.nome, email: usuario.email, nivel: usuario.nivel, vidas: usuario.vidas, cartas: usuario.cartas }
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
app.post('/usuarios', async (req, res) => {
    let { nome, email, senha } = req.body;
    nome = xss(nome);
    email = xss(email);

    try {
        const usuarioExiste = await Usuario.findOne({ email });
        if (usuarioExiste) {
            return res.status(400).json({ message: 'Este e-mail já está cadastrado.' });
        }

        const novoUsuario = new Usuario({ nome, email, senha });
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
//Não precisa nesse projeto
// app.get('/usuarios', verificarToken, async (req, res) => {
//     try {
//         // Busca todos os usuários e remove o campo 'senha' do retorno
//         const usuarios = await Usuario.find({}).select('-senha');
//         return res.status(200).json(usuarios);
//     } catch (error) {
//         return res.status(500).json({ message: 'Erro ao buscar usuários.' });
//     }
// })

//Retorna os dados do usuário logado
app.get('/usuarios', verificarToken, async (req, res) => {
    const idUsuario = req.usuario.userId; // Obtém o ID do usuário autenticado pelo token
    try {
        // Busca o usuário e remove o campo 'senha' do retorno
        const usuario = await Usuario.findById(idUsuario).select('-senha');
        return res.status(200).json(usuario);
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao buscar o usuário.' });
    }
})

//Altera nome e e-mail do usuário logado
app.patch('/usuarios', verificarToken, async (req, res) => {
    const idUsuario = req.usuario.userId; // Obtém o ID do usuário autenticado pelo token
    let { nome, email } = req.body;

    // Garante que os dados existem antes de aplicar o xss para evitar crash (TypeError)
    if (nome) nome = xss(nome);
    if (email) email = xss(email.toLowerCase()); // Força e-mail minúsculo para consistência

    try {
        const usuarioAtualizado = await Usuario.findByIdAndUpdate(
            idUsuario,
            { nome, email },
            { runValidators: true, returnDocument: 'after' } // Substituído aqui
        ).select('-senha');

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

//Altera a senha do usuário logado
app.patch('/usuarios/senha', verificarToken, async (req, res) => {
    const idUsuario = req.usuario.userId; // Obtém o ID do usuário autenticado pelo token
    const { senhaantiga, senhanova } = req.body;

    try {
        // 1. Busca o usuário pelo ID
        const usuario = await Usuario.findById(idUsuario);
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

// Altera o progresso do usuário logado
app.patch('/usuarios/progresso', verificarToken, async (req, res) => {
    const idUsuario = req.usuario.userId;
    let { nivel, vidas } = req.body; // Recebe os números diretamente

    try {
        const usuarioAtualizado = await Usuario.findByIdAndUpdate(
            idUsuario,
            { nivel, vidas },
            { runValidators: true, returnDocument: 'after' } // Substituído aqui
        ).select('-senha');

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

// Retorna as cartas do usuário autenticado
app.get('/usuarios/cartas', verificarToken, async (req, res) => {
    const idUsuario = req.usuario.userId;

    try {
        const usuario = await Usuario.findById(idUsuario).select('cartas -_id');
        if (!usuario) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        return res.status(200).json(usuario.cartas);
    } catch (error) {
        console.error("Erro ao buscar cartas:", error);
        return res.status(500).json({ message: 'Erro interno ao buscar cartas.' });
    }
});

// Adiciona uma carta ao inventário do usuário autenticado
app.post('/usuarios/cartas', verificarToken, async (req, res) => {
    const idUsuario = req.usuario.userId;
    let { carta } = req.body; // O nome ou identificador string da carta

    if (!carta) {
        return res.status(400).json({ message: 'O nome ou ID da carta é obrigatório.' });
    }
    carta = xss(carta);

    try {
        // $push insere a string no array de cartas
        const usuarioAtualizado = await Usuario.findByIdAndUpdate(
            idUsuario,
            { $push: { cartas: carta } },
            { returnDocument: 'after' } // Substituído aqui
        ).select('-senha');


        return res.status(200).json({
            message: 'Carta adicionada com sucesso!',
            cartas: usuarioAtualizado.cartas
        });
    } catch (error) {
        console.error("Erro ao adicionar carta:", error);
        return res.status(500).json({ message: 'Erro interno ao adicionar carta.' });
    }
});

// Remove uma carta específica do inventário do usuário autenticado
app.delete('/usuarios/cartas/:nomeCarta', verificarToken, async (req, res) => {
    const idUsuario = req.usuario.userId;
    const { nomeCarta } = req.params;

    try {
        // Verifica primeiro se o usuário possui a carta antes de tentar remover
        const usuarioPossui = await Usuario.findOne({ _id: idUsuario, cartas: nomeCarta });
        if (!usuarioPossui) {
            return res.status(400).json({ message: 'Você não possui essa carta no seu inventário.' });
        }

        // $pull remove a primeira ocorrência encontrada correspondente no array
        const usuarioAtualizado = await Usuario.findByIdAndUpdate(
            idUsuario,
            { $pull: { cartas: nomeCarta } },
            { returnDocument: 'after' } // Substituído aqui
        ).select('-senha');


        return res.status(200).json({
            message: 'Carta utilizada/removida com sucesso!',
            cartas: usuarioAtualizado.cartas
        });
    } catch (error) {
        console.error("Erro ao remover carta:", error);
        return res.status(500).json({ message: 'Erro interno ao remover carta.' });
    }
});

//Apaga o usuário atual
app.delete('/usuarios', verificarToken, async (req, res) => {
    const idUsuario = req.usuario.userId;

    try {
        // BLINDAGEM DE SEGURANÇA: Impede que um usuário apague a conta de outro
        // O middleware 'verificarToken' injetou os dados do token em 'req.usuario'
        // if (req.usuario.userId !== id && req.usuario.role !== 'admin') {
        //     return res.status(403).json({ 
        //         message: 'Acesso negado. Você não tem permissão para apagar este usuário.' 
        //     });
        // }

        // VALIDAÇÃO DE EXISTÊNCIA: Verifica se o usuário realmente existe no banco
        const usuarioApagado = await Usuario.findByIdAndDelete(idUsuario);

        if (!usuarioApagado) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        return res.status(200).json({ message: 'Usuário apagado com sucesso!' });

    } catch (error) {
        console.error("Erro ao deletar usuário:", error);
        return res.status(500).json({ message: 'Erro interno ao tentar apagar o usuário.' });
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Servidor ligado na porta ${process.env.PORT}!`)
})