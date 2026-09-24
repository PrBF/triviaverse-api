import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('Conexão estabelecida com o banco!')
    })
    .catch(err => {
        console.log('Erro ao conectar ao banco.')
        console.log(err)
    })

export default mongoose