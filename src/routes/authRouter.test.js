const request = require('supertest');
const app = require('../service');


const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

const { Role, DB } = require('../database/database.js');

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


test('login and logout', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(loginRes.body.user).toMatchObject(user);
  const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${loginRes.body.token}`)
  expect(logoutRes.body.message).toEqual('logout successful');
});

test('admin user', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  expect(loginRes.status).toBe(200);
});


test('get menu', async () => {
  const menuRes = await request(app).get('/api/order/menu');
  expect(menuRes.status).toBe(200);
  expect(menuRes.body[0]).toEqual({"description": "A garden of delight", "id": 1, "image": "pizza1.png", "price": 0.0038, "title": "Veggie"});
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
  length = (addItemRes.body).length;
  newItem.id = length;
  expect(addItemRes.body[(length - 1 )]).toEqual(newItem);
});

test('add menu item rejection', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
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

test('get an order', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  const userToken = loginRes.body.token;
  const orderRes = await request(app).get('/api/order').set('Authorization', `Bearer ${userToken}`);
  expect(orderRes.status).toBe(200);
  expect(orderRes.body.orders).toEqual([]);
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});

test('make an order', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  const userToken = loginRes.body.token;
  const newOrder = {"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.0038 }]};
  const newOrderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${userToken}`).send(newOrder);
  expect(newOrderRes.status).toBe(500);
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});

// need to work on mocking the server to get an actual return value.

test('unauthorized user', async () => {
  const response = await request(app).delete('/api/auth');
  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'unauthorized' });
});

test('register without full credentials', async () => {
  testUser1 = { name: 'pizza diner', password: 'a' };
  const registerRes = await request(app).post('/api/auth').send(testUser1);
  expect(registerRes.status).toBe(400);
});

test('update user', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminToken = loginRes.body.token;

  updatedCreds = {email:"a@jwt.com", password:"admin"};
  userId = loginRes.body.user.id
  const updateUser = await request(app).put(`/api/auth/1`).set('Authorization', `Bearer ${adminToken}`).send(updatedCreds);
  expect(updateUser.status).toBe(200);
  expect(updateUser.body).toEqual({ id: 1, name: '常用名字', email: 'a@jwt.com', roles: [{ role: 'admin' }] });
});

test('update user unathorized', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  const userToken = loginRes.body.token;
  updatedCreds = {"email":"a@jwt.com", "password":"admin"};
  userId = loginRes.body.user.id
  const updateUser = await request(app).put(`/api/auth/:${userId}`).set('Authorization', `Bearer ${userToken}`).send(updatedCreds);
  expect(updateUser.status).toBe(403);
  expect(updateUser.body.message).toBe("unauthorized");
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});

test('get franchise', async () => {
  const franchiseFetch = await request(app).get('/api/franchise')
  const expectedFranchiseBody = {
    "id": 15,
    "name": "3az3d0s1u3",
    "id": 21,
    "name": "0gg2dq83tc",
    "stores": [],
       };
  expect(franchiseFetch.status).toBe(200);
  expect(franchiseFetch.body[0]).toEqual(expectedFranchiseBody);
});

test('create a users franchise', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminToken = loginRes.body.token;
  const randomFranchiseName = randomName();
  const newFranchise = {
    name: randomFranchiseName,
    admins: [{"email": adminUser.email}]
  };
  const addFranchise = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminToken}`).send(newFranchise);
  expect(addFranchise.status).toBe(200);
  expect(addFranchise.body.name).toEqual(randomFranchiseName);
});

test('unable to create a users franchise', async() => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  const userToken = loginRes.body.token;
  const randomFranchiseName = randomName();
  const newFranchise = {
    name: randomFranchiseName,
    admins: [{"email": loginRes.body.user.email}]
  };
  const addFranchise = await request(app).post('/api/franchise').set('Authorization', `Bearer ${userToken}`).send(newFranchise);
  expect(addFranchise.status).toBe(403);
  expect(addFranchise.body.message).toEqual("unable to create a franchise");
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});

test('get a users franchise', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminToken = loginRes.body.token;

  const usersFranchise = await request(app).get('/api/franchise/446').set('Authorization', `Bearer ${adminToken}`);
  expect(usersFranchise.status).toBe(200);
  expect(usersFranchise.body[0].name).toEqual("18d7pscu4d");
});

// do I need to logout the admin?

test('delete a franchise', async() => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminToken = loginRes.body.token;
  const deleteFranchise = await request(app).delete('/api/franchise/15').set('Authorization', `Bearer ${adminToken}`);
  expect(deleteFranchise.body.message).toEqual("franchise deleted");
});

test('unable to delete a franchise', async() => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  const userToken = loginRes.body.token;
  const deleteFranchise = await request(app).delete('/api/franchise/15').set('Authorization', `Bearer ${userToken}`);
  expect(deleteFranchise.status).toBe(403);
  expect(deleteFranchise.body.message).toEqual("unable to delete a franchise");
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});

test('create a new franchise store', async() => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminToken = loginRes.body.token;
  const newFranchiseStore = await request(app).post('/api/franchise/28/store').set('Authorization', `Bearer ${adminToken}`).send({"franchiseId": 1, "name":"SLC"})
  expect(newFranchiseStore.status).toBe(200);
  expect(newFranchiseStore.body.franchiseId).toBe(28);
});

test('unable to create a store', async() => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  const userToken = loginRes.body.token;
  const newFranchiseStore = await request(app).post('/api/franchise/28/store').set('Authorization', `Bearer ${userToken}`).send({"franchiseId": 1, "name":"SLC"})
  expect(newFranchiseStore.status).toBe(403);
  expect(newFranchiseStore.body.message).toEqual("unable to create a store");
  await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
});

  test('delete a store', async() => {
    const adminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const adminToken = loginRes.body.token;
    const deleteFranchiseStore = await request(app).delete('/api/franchise/28/store/1').set('Authorization', `Bearer ${adminToken}`);
    expect(deleteFranchiseStore.status).toEqual(200);
    expect(deleteFranchiseStore.body.message).toEqual('store deleted');
  });

  test('unable to delete a store', async() => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
    const userToken = loginRes.body.token;
    const deleteFranchiseStore = await request(app).delete('/api/franchise/28/store/1').set('Authorization', `Bearer ${userToken}`);
    expect(deleteFranchiseStore.status).toBe(403);
    expect(deleteFranchiseStore.body.message).toEqual("unable to delete a store");
    await request(app).delete('/api/auth').set('Authorization', `Bearer ${userToken}`);
  });

  // should I mock my database?