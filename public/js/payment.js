const btn = document.getElementById('payBtn'), message = document.getElementById('message');
const payment = window.PAYMENT || {};

function show(text) { message.textContent = text; message.classList.remove('hidden'); }

function getMemberId() {
  const memberId = Number(payment.id ?? 0);
  if (!memberId) throw new Error('Payment details are missing. Please go back and complete the registration again.');
  return memberId;
}

btn?.addEventListener('click', async () => {
  btn.disabled = true; btn.textContent = 'Processing…';
  try {
    const memberId = getMemberId();
    if (!window.Razorpay) throw new Error('Unable to load Razorpay checkout');
    const r = await fetch(`/api/payments/${memberId}/order`, { method: 'POST' });
    const order = await r.json();
    if (!r.ok) throw new Error(order.error || 'Unable to create order');

    const checkout = new Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: 'U.P. Boxing Association',
      description: 'Registration',
      order_id: order.order_id,
      prefill: { name: order.member_name, email: order.member_email, contact: order.member_mobile },
      theme: { color: '#c8202f' },
      handler: async response => {
        try {
          const v = await fetch(`/api/payments/${memberId}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response)
          });
          const data = await v.json();
          if (!v.ok) throw new Error(data.error || 'Payment verification failed');
          window.location.href = `/receipt/${memberId}`;
        } catch (e) {
          show(e.message);
          btn.disabled = false;
          btn.textContent = `Pay ₹${payment.fee || 0}`;
        }
      },
      modal: { ondismiss: () => { btn.disabled = false; btn.textContent = `Pay ₹${payment.fee || 0}`; } }
    });

    checkout.on('payment.failed', r => {
      show(r.error?.description || 'Payment failed');
      btn.disabled = false;
      btn.textContent = `Pay ₹${payment.fee || 0}`;
    });
    checkout.open();
  } catch (e) {
    show(e.message);
    btn.disabled = false;
    btn.textContent = `Pay ₹${payment.fee || 0}`;
  }
});
