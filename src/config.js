module.exports = {
  jwtSecret: '455679468562795',
  db: {   
    connection: {      
      host: '127.0.0.1',
      user: 'root',
      password: 'BYUSparks:Customary6',
      database: 'pizza',
      connectTimeout: 60000,
    },
    listPerPage: 10,
  },
  factory: {
    url: 'https://pizza-factory.cs329.click',
    apiKey: '10745af2b2c34563a9ccf17a382709e9',
  },
  metrics: {
    source: 'jwt-pizza-service-dev',
    userId: 1909296,
    url: "https://influx-prod-13-prod-us-east-0.grafana.net/api/v1/push/influx/write",
    apiKey: "glc_eyJvIjoiMTI3NjkyOSIsIm4iOiJzdGFjay0xMDk2MTUyLWludGVncmF0aW9uLWp3dC1waXp6YS1tZXRyaWNzX3R3byIsImsiOiJ5ODNJM0N6bkc3ODg1VFpqaWloNzBGTTciLCJtIjp7InIiOiJwcm9kLXVzLWVhc3QtMCJ9fQ=="
  },
  logging: {
    "source": "jwt-pizza-service-dev",
    "userId": 1053931,
    "url": "https://logs-prod-006.grafana.net/loki/api/v1/push",
    "apiKey": "glc_eyJvIjoiMTI3NjkyOSIsIm4iOiJzdGFjay0xMDk2MTUyLWludGVncmF0aW9uLWp3dC1waXp6YS1sb2dzIiwiayI6IlI5T3JCT1I5Tk81OW1yOVVJdjI5WTUwNCIsIm0iOnsiciI6InByb2QtdXMtZWFzdC0wIn19"
  }
};
