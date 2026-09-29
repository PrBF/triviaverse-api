import Usuario from "./models/usuario.js"

const usuario1 = new Usuario({
     nome: 'Eu',
     email: 'eu',
     senha: '123'
})

usuario1.save()
    .then(usuario => {
        console.log('Usuário criado: ', usuario)
    })
    .catch( e => {
        console.log(e)
    })