import mongoose from "../db.js"
import bcrypt from 'bcryptjs';

const usuarioSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    senha: { type: String, required: true },
    nivel: Number,
    vidas: Number
}, { timestamps: true });

// GATILHO: Roda automaticamente ANTES de salvar o usuário no banco de dados
usuarioSchema.pre('save', async function () {
    // Se a senha não foi modificada (ex: atualizou apenas o nome), pula a criptografia
    if (!this.isModified('senha')) return;

    try {
        // Gera o "salt" (tempero aleatório para fortalecer o hash) com custo 10
        const salt = await bcrypt.genSalt(10);
        // Substitui a senha em texto limpo pela senha criptografada
        this.senha = await bcrypt.hash(this.senha, salt);
    } catch (error) {
        throw error;
    }
});

// MÉTODO AUXILIAR: Compara a senha digitada no login com o hash do banco
usuarioSchema.methods.compararSenha = async function (senhaDigitada) {
    return await bcrypt.compare(senhaDigitada, this.senha);
};

const Usuario = mongoose.model('Usuario', usuarioSchema);
export default Usuario;