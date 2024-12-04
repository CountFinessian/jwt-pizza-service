module.exports = {
  jwtSecret: '455679468562795',
  db: {   
    connection: {      
      host: '127.0.0.1',
      user: 'root',
      password: 'tempdbpassword',
      database: 'pizza',
      connectTimeout: 60000,
    },
    listPerPage: 10,
  },
  factory: {
    url: 'https://pizza-factory.cs329.click',
    apiKey: '10745af2b2c34563a9ccf17a382709e9',
  },
};
