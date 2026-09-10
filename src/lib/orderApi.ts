export type PublicOrderItem = {
  productId: string;
  productName: string;
  category: string;
  grams: number;
  lineTotalBani: number;
};

export type PublicOrderPayload = {
  orderCode: string;
  customerName: string;
  phone: string;
  totalBani: number;
  scheduledOrderDates: string[];
  items: PublicOrderItem[];
};

const PROJECT_ID = 'comanda-bunatati';
const API_KEY = 'AIzaSyDu86lUJXgQYTkbNQlLX3bIFd5ht3_PWoY';

function stringValue(value: string) {
  return { stringValue: value };
}

function integerValue(value: number) {
  return { integerValue: String(Math.round(value)) };
}

export async function submitPublicOrder(order: PublicOrderPayload) {
  const documentId = order.orderCode.toLowerCase();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/groupOrders?documentId=${encodeURIComponent(documentId)}&key=${encodeURIComponent(API_KEY)}`;

  const body = {
    fields: {
      orderCode: stringValue(order.orderCode),
      customerName: stringValue(order.customerName),
      phone: stringValue(order.phone),
      totalBani: integerValue(order.totalBani),
      paid: { booleanValue: false },
      status: stringValue('Trimisă'),
      createdAt: { timestampValue: new Date().toISOString() },
      scheduledOrderDates: {
        arrayValue: {
          values: order.scheduledOrderDates.map(stringValue),
        },
      },
      items: {
        arrayValue: {
          values: order.items.map((item) => ({
            mapValue: {
              fields: {
                productId: stringValue(item.productId),
                productName: stringValue(item.productName),
                category: stringValue(item.category),
                grams: integerValue(item.grams),
                lineTotalBani: integerValue(item.lineTotalBani),
              },
            },
          })),
        },
      },
    },
  };

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`Firestore REST ${response.status}: ${details}`);
    }
  } finally {
    window.clearTimeout(timeout);
  }
}
