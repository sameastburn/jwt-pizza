import { test, expect } from 'playwright-test-coverage';

test('purchase with login', async ({ page }) => {
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });

  await page.route('*/**/api/franchise', async (route) => {    
    const franchiseRes = [
      {
        id: 2,
        name: 'LotaPizza',
        admins: [
          { id: 10, name: 'Alice Johnson' },
          { id: 11, name: 'Bob Smith' },
        ],
        stores: [
          { id: 4, name: 'Lehi', totalRevenue: 0.005 },
          { id: 5, name: 'Springville', totalRevenue: 0.007 },
          { id: 6, name: 'American Fork', totalRevenue: 0.004 },
        ],
      },
      {
        id: 3,
        name: 'PizzaCorp',
        admins: [
          { id: 12, name: 'Carol Williams' },
        ],
        stores: [
          { id: 7, name: 'Spanish Fork', totalRevenue: 0.006 },
        ],
      },
      {
        id: 4,
        name: 'TopSpot',
        admins: [],
        stores: [],
      },
    ];

    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: franchiseRes });
  });

  await page.route('*/**/api/auth', async (route) => {
    const method = route.request().method();
  
    if (method === 'PUT') {
      // Handle login
      const loginReq = route.request().postDataJSON();
      expect(loginReq).toHaveProperty('email');
      expect(loginReq).toHaveProperty('password');
  
      let loginRes;
  
      if (loginReq.email === 'd@jwt.com' && loginReq.password === 'a') {
        // Diner user
        loginRes = {
          user: { id: 3, name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: 'diner' }] },
          token: 'abcdef',
        };
      } else if (loginReq.email === 'a@jwt.com' && loginReq.password === 'admin') {
        // Admin user
        loginRes = {
          user: { id: 1, name: 'Admin User', email: 'a@jwt.com', roles: [{ role: 'admin' }] },
          token: 'ghijkl',
        };
      } else {
        // Invalid credentials
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' }),
        });
        return;
      }
  
      await route.fulfill({ json: loginRes });
  
    } else if (method === 'DELETE') {
      // Handle logout
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Logged out successfully' }),
      });
  
    } else if (method === 'POST') {
      // Handle registration
      const registerReq = route.request().postDataJSON();
      expect(registerReq).toHaveProperty('name');
      expect(registerReq).toHaveProperty('email');
      expect(registerReq).toHaveProperty('password');
  
      // Mock registration response
      const registerRes = {
        user: {
          id: 5, // New user ID
          name: registerReq.name,
          email: registerReq.email,
          roles: [{ role: 'diner' }], // Assuming new users are diners
        },
        token: 'newusertoken',
      };
  
      await route.fulfill({
        status: 201, // HTTP 201 Created
        contentType: 'application/json',
        body: JSON.stringify(registerRes),
      });
  
    } else {
      throw new Error('Missing mock implementation for /api/auth/');
    }
  });
    
  await page.route('*/**/api/order', async (route) => {
    const method = route.request().method();

    if (method === 'POST') {
      // Existing POST request handling
      const orderReq = {
        items: [
          { menuId: 1, description: 'Veggie', price: 0.0038 },
          { menuId: 2, description: 'Pepperoni', price: 0.0042 },
        ],
        storeId: '4',
        franchiseId: 2,
      };
      const orderRes = {
        order: {
          items: [
            { menuId: 1, description: 'Veggie', price: 0.0038 },
            { menuId: 2, description: 'Pepperoni', price: 0.0042 },
          ],
          storeId: '4',
          franchiseId: 2,
          id: 23,
        },
        jwt: 'eyJpYXQ',
      };
      expect(route.request().postDataJSON()).toMatchObject(orderReq);
      await route.fulfill({ json: orderRes });

    } else if (method === 'GET') {
      const orderHistoryRes = [
        {
          id: 23,
          items: [
            { menuId: 1, description: 'Veggie', price: 0.0038 },
            { menuId: 2, description: 'Pepperoni', price: 0.0042 },
          ],
          storeId: '4',
          franchiseId: 2,
          date: '2023-10-15T12:34:56Z',
          status: 'Completed',
        },
      ];
      await route.fulfill({ json: orderHistoryRes });
    } else {
      throw('missing mock implementation for /api/order/');
    }
  });

  await page.goto('/');

  // Go to order page
  await page.getByRole('button', { name: 'Order now' }).click();

  // Create order
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 2');
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Login
  await page.getByPlaceholder('Email address').click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Email address').press('Tab');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  // Pay
  await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();

  // Check balance
  await expect(page.getByText('0.008')).toBeVisible();

  // Verify
  await page.getByRole('button', { name: 'Verify' }).click();

  // Go to franchise page
  await page.getByLabel('Global').getByRole('link', { name: 'Franchise' }).click();  

  // Go to about page
  await page.getByRole('link', { name: 'About' }).click();
  
  // Go to history page
  await page.getByRole('link', { name: 'History' }).click();

  // Go to diner dashboard
  await page.getByRole('link', { name: 'KC' }).click();

  // Admin dashboard
  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('main').getByText('Register').click();
  await page.getByRole('main').getByText('Login').click();
  await page.getByPlaceholder('Email address').fill('a@jwt.com');
  await page.getByPlaceholder('Email address').press('Tab');
  await page.getByPlaceholder('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Admin' }).click();
  await page.getByRole('button', { name: 'Add Franchise' }).click();
  await page.getByPlaceholder('franchise name').click();
  await page.getByPlaceholder('franchise name').fill('franchise name test');
  await page.getByPlaceholder('franchise name').press('Tab');
  await page.getByPlaceholder('franchisee admin email').fill('franchse admin');
  await page.getByRole('button', { name: 'Create' }).click();

  // Go to docs
  await page.goto('/docs');

  // Register
  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByPlaceholder('Full name').fill('full name');
  await page.getByPlaceholder('Full name').press('Tab');
  await page.getByPlaceholder('Email address').fill('fullemail@test.com');
  await page.getByPlaceholder('Email address').press('Tab');
  await page.getByPlaceholder('Password').fill('b');
  await page.getByRole('button', { name: 'Register' }).click();

  // 404
  await page.goto('/no-exist');
});

