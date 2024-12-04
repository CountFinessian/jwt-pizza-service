module.exports =  {
    jwtSecret: '4785278785',
    db: {
      connection: {
        host: 'host.docker.internal',
        user: 'root',
        password: 'BYUSParks:CUstomary6',
        database: 'pizza',
        connectTimeout: 60000,
      },
      listPerPage: 10,
    },
    factory: {
      url: 'https://pizza.krazykid.click',
      apiKey: '10745af2b2c34563a9ccf17a382709e9',    
    },
    metrics: {
      "source": "jwt-pizza-service-dev",
      "userId": 1909296,
      "url": "https://influx-prod-13-prod-us-east-0.grafana.net/api/v1/push/influx/write",
      "apiKey": "glc_eyJvIjoiMTI3NjkyOSIsIm4iOiJzdGFjay0xMDk2MTUyLWludGVncmF0aW9uLWp3dC1waXp6YS1tZXRyaWNzX3R3byIsImsiOiJ5ODNJM0N6bkc3ODg1VFpqaWloNzBGTTciLCJtIjp7InIiOiJwcm9kLXVzLWVhc3QtMCJ9fQ=="
    }
 };