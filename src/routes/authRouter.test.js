const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

// Import the mocked module
const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };

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
  await request(app).post('/api/auth').send(testUser);
});


test('login and logout', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
  const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${loginRes.body.token}`);
  expect(logoutRes.body.message).toEqual('logout successful');
});

test('admin user', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  expect(loginRes.status).toBe(200);
});

test('add menu item', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminToken = loginRes.body.token;

  const newItem = {
    title: 'Student',
    description: 'No topping, no sauce, just carbs',
    image: 'pizza9.png',
    price: 0.0001,
  };

  const addItemRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminToken}`).send(newItem);

  expect(addItemRes.status).toBe(200);
  const length = addItemRes.body.length;
  newItem.id = length;
  expect(addItemRes.body[length - 1]).toEqual(newItem);
});

test('get menu', async () => {
  const menuRes = await request(app).get('/api/order/menu');
  expect(menuRes.status).toBe(200);
  expect(menuRes.body[0]).toEqual({ description: "No topping, no sauce, just carbs", id: 1, image: "pizza9.png", "price": 0.0001, "title": "Student", });
});

test('add menu item rejection', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const userToken = loginRes.body.token;

  const newItem = {
    title: 'Teacher',
    description: 'All sauce',
    image: 'pizza3.png',
    price: 0.0001,
  };

  const addItemRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${userToken}`).send(newItem);
  expect(addItemRes.status).toBe(403);
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});


test('make an order', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const userToken = loginRes.body.token;
  const newOrder = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.0038 }] };
  const newOrderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${userToken}`).send(newOrder);
  expect(newOrderRes.status).toBe(200);
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});

test('get an order', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const userToken = loginRes.body.token;
  const orderRes = await request(app).get('/api/order').set('Authorization', `Bearer ${userToken}`);
  expect(orderRes.status).toBe(200);
  expect(orderRes.body.orders[0].items).toEqual([
        [
          {
            "description": "Veggie",
             "id": 1,
             "menuId": 1,
             "price": 0.0038,
          },
         ]
    ]);
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});

test('unauthorized user', async () => {
  const response = await request(app).delete('/api/auth');
  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'unauthorized' });
});

test('register without full credentials', async () => {
  const testUser1 = { name: 'pizza diner', password: 'a' };
  const registerRes = await request(app).post('/api/auth').send(testUser1);
  expect(registerRes.status).toBe(400);
});

test('update user', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminToken = loginRes.body.token;

  const updatedCreds = { email: 'a@jwt.com', password: 'admin' };
  const userId = loginRes.body.user.id;
  const updateUser = await request(app).put(`/api/auth/${userId}`).set('Authorization', `Bearer ${adminToken}`).send(updatedCreds);
  expect(updateUser.status).toBe(200);
  expect(updateUser.body.email).toEqual('a@jwt.com');
});

test('update user unauthorized', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const userToken = loginRes.body.token;
  const updatedCreds = { email: 'a@jwt.com', password: 'admin' };
  const updateUser = await request(app).put('/api/auth/1').set('Authorization', `Bearer ${userToken}`).send(updatedCreds);
  expect(updateUser.status).toBe(401);
  expect(updateUser.body.message).toBe('unauthorized');
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});

test('create a users franchise', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminToken = loginRes.body.token;
  const randomFranchiseName = randomName();
  const newFranchise = {
    name: randomFranchiseName,
    admins: [{ email: adminUser.email }],
  };
  const addFranchise = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminToken}`).send(newFranchise);
  expect(addFranchise.status).toBe(200);
  expect(addFranchise.body.name).toEqual(randomFranchiseName);
});

test('create a users franchise unkown email', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminToken = loginRes.body.token;
  const randomFranchiseName = randomName();
  const newFranchise = {
    name: randomFranchiseName,
    admins: [{ email: 'randomfranchise@jwtSecret.com' }],
  };
  const addFranchise = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminToken}`).send(newFranchise);
  expect(addFranchise.status).toBe(404);
  expect(addFranchise.body.message).toEqual('unknown user for franchise admin randomfranchise@jwtSecret.com provided');
});

test('get franchise', async () => {
  const franchiseFetch = await request(app).get('/api/franchise');
  expect(franchiseFetch.status).toBe(200);
  expect(franchiseFetch.body[0].id).toEqual(1);
});

test('unable to create a users franchise', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const userToken = loginRes.body.token;


  const randomFranchiseName = randomName();
  const newFranchise = {
    name: randomFranchiseName,
    admins: [{ email: loginRes.body.user.email }],
  };
  const addFranchise = await request(app).post('/api/franchise').set('Authorization', `Bearer ${userToken}`).send(newFranchise);
  expect(addFranchise.status).toBe(403);
  expect(addFranchise.body.message).toEqual('unable to create a franchise');
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});

test('get a users franchise as admin', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminToken = loginRes.body.token;

  const usersFranchise = await request(app).get('/api/franchise/6').set('Authorization', `Bearer ${adminToken}`);
  expect(usersFranchise.status).toBe(200);
  expect(usersFranchise.body.length).toEqual(0);
});

test('get a users franchise as user', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const userToken = loginRes.body.token;

  const usersFranchise = await request(app).get('/api/franchise/1').set('Authorization', `Bearer ${userToken}`);
  expect(usersFranchise.status).toBe(403);
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});

test('delete a franchise', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminToken = loginRes.body.token;
  const deleteFranchise = await request(app).delete('/api/franchise/15').set('Authorization', `Bearer ${adminToken}`);
  expect(deleteFranchise.body.message).toEqual('franchise deleted');
});

test('unable to delete a franchise', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const userToken = loginRes.body.token;
  const deleteFranchise = await request(app).delete('/api/franchise/15').set('Authorization', `Bearer ${userToken}`);
  expect(deleteFranchise.status).toBe(403);
  expect(deleteFranchise.body.message).toEqual('unable to delete a franchise');
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});

test('create a new franchise store', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminToken = loginRes.body.token;
  const newFranchiseStore = await request(app).post('/api/franchise/1/store').set('Authorization', `Bearer ${adminToken}`).send({ franchiseId: 1, name: 'SLC' });
  expect(newFranchiseStore.status).toBe(200);
  expect(newFranchiseStore.body.franchiseId).toBe(1);
});

test('unable to create a store', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const userToken = loginRes.body.token;
  const newFranchiseStore = await request(app).post('/api/franchise/28/store').set('Authorization', `Bearer ${userToken}`).send({ franchiseId: 1, name: 'SLC' });
  expect(newFranchiseStore.status).toBe(403);
  expect(newFranchiseStore.body.message).toEqual('unable to create a store');
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});

test('delete a store', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminToken = loginRes.body.token;
  const deleteFranchiseStore = await request(app).delete('/api/franchise/28/store/1').set('Authorization', `Bearer ${adminToken}`);
  expect(deleteFranchiseStore.status).toEqual(200);
  expect(deleteFranchiseStore.body.message).toEqual('store deleted');
});

test('unable to delete a store', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const userToken = loginRes.body.token;
  const deleteFranchiseStore = await request(app).delete('/api/franchise/28/store/1').set('Authorization', `Bearer ${userToken}`);
  expect(deleteFranchiseStore.status).toBe(403);
  expect(deleteFranchiseStore.body.message).toEqual('unable to delete a store');
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});