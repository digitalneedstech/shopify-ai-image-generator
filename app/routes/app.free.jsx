import { useLoaderData, useNavigate } from "@remix-run/react";
import { authenticate, MONTHLY_PLAN, YEARLY_PLAN } from "../shopify.server";
import { json } from "@remix-run/node";
import { useEffect } from "react";
import { Page } from "@shopify/polaris";
export async function loader({ request }) {
  const { billing,session } = await authenticate.admin(request);
  let {shop} =session;
  let myshop =shop.replace(".myshopify.com","");
  const billingCheck = await billing.require({
    plans: [MONTHLY_PLAN,YEARLY_PLAN],
    onFailure: async () => billing.request({ plan: MONTHLY_PLAN }),
  });

  const subscription = billingCheck.appSubscriptions[0];
  const cancelledSubscription = await billing.cancel({
    subscriptionId: subscription.id,
    isTest: false,
    prorate: false,
   });
   return json({"status":cancelledSubscription.status});
  }

  export default function Index() {
    const navigate=useNavigate();
    useEffect(() => {
      navigate("/app");
    }, []);
    const { plan } = useLoaderData();
  
    return (
      <Page>
        
        </Page>
    );
  }
