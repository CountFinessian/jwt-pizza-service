const request = require('supertest');
const app = require('../service');
const { authRouter } = require('./authRouter');
const config = require('../config');



const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

const { Role, DB } = require('../database/database.js');
const { post } = require('./orderRouter');
function randomName() {
  return Math.random().toString(36).substring(2, 12);
}
async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  await DB.addUser(user);

  user.password = 'toomanysecrets';
  return user;
}

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(loginRes.body.user).toMatchObject(user);
});

// test('admin user', async () => {
//   const adminUser = await createAdminUser();
//   const loginRes = await request(app).put('/api/auth').send(adminUser);
//   expect(loginRes.status).toBe(200);
// });


// test('get menu', async () => {
//   const menuRes = await request(app).get('/api/order/menu');
//   expect(menuRes.status).toBe(200);
//   expect(menuRes.body[0]).toEqual({"description": "A garden of delight", "id": 1, "image": "pizza1.png", "price": 0.0038, "title": "Veggie"});
// });

// test('add menu item', async () => {
//   const adminUser = await createAdminUser();
//   const loginRes = await request(app).put('/api/auth').send(adminUser);
//   const adminToken = loginRes.body.token;

//   const newItem = {
//     title: 'Student',
//     description: 'No topping, no sauce, just carbs',
//     image: 'pizza9.png',
//     price: 0.0001,
//   };

//   const addItemRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminToken}`).send(newItem);

//   expect(addItemRes.status).toBe(200);
//   length = (addItemRes.body).length;
//   newItem.id = length;
//   expect(addItemRes.body[(length - 1 )]).toEqual(newItem);
// });

// test('add mennu item rejection', async () => {
//   const loginRes = await request(app).put('/api/auth').send(testUser);
//   expect(loginRes.status).toBe(200);
//   expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
//   const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
//   expect(loginRes.body.user).toMatchObject(user);
//   const userToken = loginRes.body.token;

//   const newItem = {
//     title: 'Teacher',
//     description: 'All sauce',
//     image: 'pizza3.png',
//     price: 0.0001,
//   };

//   const addItemRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${userToken}`).send(newItem);
//   expect(addItemRes.status).toBe(403);
// });

// test('make an order', async () => {
//   const adminUser = await createAdminUser();
//   const loginRes = await request(app).put('/api/auth').send(adminUser);
//   const adminToken = loginRes.body.token;

//   const newOrder = {"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]};

//   const addItemRes = await request(app).post('/api/order').set('Authorization', `Bearer ${adminToken}`).send(newOrder);
// });






