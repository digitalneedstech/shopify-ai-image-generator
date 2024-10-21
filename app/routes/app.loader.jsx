import { ANNUAL_PLAN, authenticate, MONTHLY_PLAN } from "../shopify.server";
import { json } from "@remix-run/node";
export async function loader({ request }) {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const { admin, billing } = await authenticate.admin(request);
    const productsCountResponse = await admin.graphql(
      `#graphql
    query {
  productsCount{
    count
  }
  }`,
    );
  
    const productsCount = await productsCountResponse.json();
    
    console.log("cursor2",cursor);
    let response;
    let data;
    if(typeof cursor!== undefined && cursor!==null){
      response = await admin.graphql(
        `#graphql
      query ($cursor:String,$number:Int) {
        products(first:$number,after:$cursor) {
        edges {
            node {
          title
          id
          description   
          onlineStoreUrl
          featuredImage {
            url
          }
            
      }
          cursor
      }
          pageInfo{
            hasNextPage
          }
      
        }
      }`,{
      variables:{
        number:20,
        cursor:cursor
      }
    }
      );
      data = await response.json();
    data.data.call="second";
    data.data.cursor=cursor;
    }
    else{
    response = await admin.graphql(
      `#graphql
    query ($number:Int) {
      products(first:$number) {
      edges {
          node {
        title
        id
        description   
        onlineStoreUrl
        featuredImage {
          url
        }
          
    }
        cursor
    }
        pageInfo{
          hasNextPage
        }
    
      }
    }`,{
    variables:{
      number:20
    }
  }
    );
  
    data = await response.json();
    data.data.call="first";
    }
    
    data.data.count = productsCount.data.productsCount.count;
    data.data.message = "ok";
    try {
      // Attempt to check if the shop has an active payment for any plan
      const billingCheck = await billing.require({
        plans: [MONTHLY_PLAN, ANNUAL_PLAN],
        isTest: true,
        // Instead of redirecting on failure, just catch the error
        onFailure: () => {
          throw new Error("No active plan");
        },
      });
  
      // If the shop has an active subscription, log and return the details
      const subscription = billingCheck.appSubscriptions[0];
      console.log(`Shop is on ${subscription.name} (id ${subscription.id})`);
  
      data.data.plan = subscription;
      return json(data);
    } catch (error) {
      // If the shop does not have an active plan, return an empty plan object
      if (error.message === "No active plan") {
        console.log("Shop does not have any active plans.");
        data.data.plan = { "name": "Free" };
        return json(data);
      }
      // If there is another error, rethrow it
      throw error;
    }
  }