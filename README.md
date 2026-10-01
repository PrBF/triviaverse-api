# 🎮 Documentação da API – Usuários, Progresso e Cartas

Esta documentação detalha os endpoints da API para o gerenciamento de contas de jogadores, atualização de progresso (nível/vidas) e controle do inventário de cartas.

## 🔒 Política de Autenticação (Cookies httpOnly)

A API utiliza autenticação baseada em sessões seguras via **JWT inserido em Cookies `httpOnly`**.
* **Como funciona:** Ao efetuar o login com sucesso na rota `/login`, o navegador receberá e armazenará automaticamente um cookie chamado `token`.
* **Duração da Sessão:** O login permanece ativo por **7 dias**.
* **Atenção no Frontend:** 
  1. O desenvolvedor frontend **não precisa** extrair o token do cookie nem salvá-lo de forma manual (ex: `localStorage`).
  2. Todas as requisições para rotas protegidas **devem incluir obrigatoriamente a opção de credenciais**. No Axios, utilize `withCredentials: true`. No Fetch API, utilize `credentials: 'include'`. Caso contrário, a requisição falhará com `401 Acesso Negado`.

---

## 👥 Endpoints de Autenticação e Usuários

### 1. Efetuar Login
Autentica o jogador e injeta o cookie seguro no navegador.
* **Rota:** `POST /login`
* **Corpo da Requisição (JSON):**
```json
{
  "email": "jogador@email.com",
  "password": "senhaSegura123"
}
```
* **Resposta de Sucesso (`200 OK`):**
```json
{
  "message": "Login efetuado com sucesso!",
  "user": {
    "id": "64b0f1a2c3d4e5f6a7b8c9d0",
    "nome": "Jogador Um",
    "email": "jogador@email.com",
    "nivel": 1,
    "vidas": 5,
    "cartas": []
  }
}
```

### 2. Encerrar Sessão (Logout)
Remove o cookie de autenticação do navegador.
* **Rota:** `POST /logout`
* **Resposta de Sucesso (`200 OK`):**
```json
{
  "message": "Logout efetuado com sucesso!"
}
```

### 3. Cadastrar Novo Usuário
Registra uma nova conta de jogador. Propriedades como `nivel` (1), `vidas` (5) e o inventário de `cartas` ([]) são inicializados automaticamente com valores padrão pelo banco de dados.
* **Rota:** `POST /usuarios`
* **Corpo da Requisição (JSON):**
```json
{
  "nome": "Jogador Um",
  "email": "jogador@email.com",
  "senha": "senhaSegura123"
}
```
* **Resposta de Sucesso (`201 Created`):**
```json
{
  "message": "Usuário cadastrado com sucesso!",
  "usuario": {
    "nome": "Jogador Um",
    "email": "jogador@email.com",
    "nivel": 1,
    "vidas": 5,
    "cartas": [],
    "_id": "64b0f1a2c3d4e5f6a7b8c9d0"
  }
}
```

### 4. Buscar Perfil Logado
Retorna todas as informações da conta do jogador atualmente autenticado.
* **Rota:** `GET /usuarios`
* **Resposta de Sucesso (`200 OK`):**
```json
{
  "_id": "64b0f1a2c3d4e5f6a7b8c9d0",
  "nome": "Jogador Um",
  "email": "jogador@email.com",
  "nivel": 1,
  "vidas": 5,
  "cartas": []
}
```

### 5. Alterar Nome e E-mail
Atualiza os dados cadastrais básicos da conta logada.
* **Rota:** `PATCH /usuarios`
* **Corpo da Requisição (JSON):**
```json
{
  "nome": "Novo Nome do Jogador",
  "email": "novoemail@email.com"
}
```

### 6. Alterar Senha
Modifica a credencial de acesso validando a senha atual.
* **Rota:** `PATCH /usuarios/senha`
* **Corpo da Requisição (JSON):**
```json
{
  "senhaantiga": "senhaSegura123",
  "senhanova": "novaSenhaSuperSegura456"
}
```

### 7. Excluir Conta Permanetemente
Apaga o registro do jogador que está autenticado.
* **Rota:** `DELETE /usuarios`

---

## 📈 Endpoints de Progresso e Gameplay

> ⚠️ **Nota de Segurança:** O backend gerencia o ID do jogador de forma implícita com base no cookie descriptografado. Parâmetros como IDs numéricos/strings não devem ser trafegados nas URLs dessas rotas.

### 1. Atualizar Progresso (Nível e Vidas)
Atualiza os atributos de gameplay do usuário logado.
* **Rota:** `PATCH /usuarios/progresso`
* **Corpo da Requisição (JSON):**
```json
{
  "nivel": 3,
  "vidas": 4
}
```
* **Resposta de Sucesso (`200 OK`):**
```json
{
  "message": "Usuário atualizado com sucesso!",
  "usuario": {
    "_id": "64b0f1a2c3d4e5f6a7b8c9d0",
    "nome": "Jogador Um",
    "email": "jogador@email.com",
    "nivel": 3,
    "vidas": 4,
    "cartas": []
  }
}
```

### 2. Listar Cartas do Inventário
Retorna o array contendo os nomes ou strings de todas as cartas atuais do jogador logado.
* **Rota:** `GET /usuarios/cartas`
* **Resposta de Sucesso (`200 OK`):**
```json
[
  "carta_fogo_01",
  "carta_escudo_lendario",
  "carta_cura_rapida"
]
```

### 3. Adicionar Carta ao Inventário
Insere uma nova carta (string de texto simples) à lista do jogador atual.
* **Rota:** `POST /usuarios/cartas`
* **Corpo da Requisição (JSON):**
```json
{
  "carta": "carta_fogo_01"
}
```
* **Resposta de Sucesso (`200 OK`):**
```json
{
  "message": "Carta adicionada com sucesso!",
  "cartas": [
    "carta_fogo_01"
  ]
}
```

### 4. Utilizar ou Remover uma Carta
Remove uma instância específica de carta do inventário do jogador (por exemplo, ao ser consumida em uma partida).
* **Rota:** `DELETE /usuarios/cartas/:nomeCarta`
* **Exemplo de URL:** `/usuarios/cartas/carta_fogo_01`
* **Respostas Possíveis:**
  * `200 OK`: Caso a carta seja removida com sucesso. Retorna a lista atualizada de cartas.
  * `400 Bad Request`: Se o jogador não possuir a carta informada no inventário (`"Você não possui essa carta no seu inventário."`).

---

## 🛠️ Códigos de Status HTTP Úteis para o Frontend

* **`200 OK`**: Operação bem-sucedida.
* **`201 Created`**: Novo recurso criado (usado no cadastro de jogador).
* **`400 Bad Request`**: Dados obrigatórios ausentes ou falha em validações de regras de jogo (ex: tentar usar carta que não possui).
* **`401 Unauthorized`**: Cookie de autenticação ausente ou inválido. O jogador deve ser redirecionado para a tela de login.
* **`404 Not Found`**: O recurso solicitado não existe no banco de dados.
* **`500 Internal Server Error`**: Ocorreu uma falha inesperada no processamento interno do servidor.