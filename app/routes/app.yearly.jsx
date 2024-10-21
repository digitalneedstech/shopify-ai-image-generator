import { authenticate,YEARLY_PLAN  } from "../shopify.server";

export async function loader({ request }) {
  const { billing,session } = await authenticate.admin(request);
  let {shop} =session;
  let myshop =shop.replace(".myshopify.com","");
  await billing.require({
    plans: [YEARLY_PLAN],
    onFailure: async () => billing.request({
      plan: YEARLY_PLAN,
      isTest: true,
      returnUrl: `https://admin.shopify.com/store/${myshop}/apps/ai-image-creator/app`
    }),
  });
};
