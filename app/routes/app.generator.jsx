import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import React, { useEffect, useRef, useState } from "react";
import {
  EmptyState,
  IndexTable,
  Layout,
  Page,
  Spinner,
  TextField,
  Thumbnail,
  useIndexResourceState,
} from "@shopify/polaris";
import { Buffer } from 'buffer';
import { YEARLY_PLAN, authenticate, MONTHLY_PLAN } from "../shopify.server";
import { Modal, TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import TableRowComponent from "../components/table_row/table_row";
import axios from "axios";
import { useSearchParams } from 'react-router-dom';
/*
export function shouldRevalidate({
  currentParams,
  nextParams,
  defaultShouldRevalidate,
}) {
  const currentId = currentParams.slug.split("--")[1];
  const nextId = nextParams.slug.split("--")[1];
  if (currentId === nextId) {
    return false;
  }

  return defaultShouldRevalidate;
}
*/
export async function loader({ request }) {
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
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const dir = url.searchParams.get("dir");
  console.log("cursor2",cursor);
  let response;
  let data;
  if(typeof cursor!== undefined && cursor!==null){
    if(dir=="after"){
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
          hasPreviousPage
        }
    
      }
    }`,{
    variables:{
      number:10,
      cursor:cursor
    }
  }
    );
  }else{
    response = await admin.graphql(
      `#graphql
    query ($cursor:String,$number:Int) {
      products(last:$number,before:$cursor) {
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
          hasPreviousPage
        }
    
      }
    }`,{
    variables:{
      number:10,
      cursor:cursor
    }
  }
    );
  }
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
        hasPreviousPage
      }
  
    }
  }`,{
  variables:{
    number:10
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
      plans: [MONTHLY_PLAN, YEARLY_PLAN],
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

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();
  
  const image = new admin.rest.resources.Image({ session: session });
  image.product_id = formData.get("id");
  image.position = 1;
  image.attachment = formData.get("image")
  image.filename = "name.jpeg";
  image.metafields = [
    {
      "key": "new",
      "value": "newvalue",
      "type": "single_line_text_field",
      "namespace": "global"
    }
  ];
  await image.save({
    update: true,
  });
  return json({
    message: "ok",
    title: `${formData.get("title")}`,
    description: `${formData.get("description")}`,
    id: formData.get("id"),
  });

}
export const shouldRevalidate = ({formMethod, currentParams, nextParams, defaultShouldRevalidate})=>{
  if(formMethod === "GET" && currentParams.cursor === nextParams.cursor) return false;
  return defaultShouldRevalidate;
}

export default function GeneratorComponent() {
  const [prompt, setPrompt] = useState({ prompt: "" });
  const [imageUrl, setImageUrl] = useState(null);
  const [imageBlob, setImageBlob] = useState(null);
  const [error, setError] = useState(null);
  const [regenerate, setRegenerate] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useLoaderData();
  console.log("user",user);
  const [updateInProgress, setUpdateInProgress] = useState(false);
  const shopify = useAppBridge();
  const fetcher = useFetcher();
  const productId = fetcher.data?.message?.replace("ok", "");
  const fetcherRef = useRef();

  function reset() {
    setUpdateInProgress(false);
    setImageBlob(null);
    setImageUrl(null);
    setRegenerate(false);
    setPrompt((prev) => ({ ...prev, prompt: "" }));
    setError(null);
  }
  useEffect(() => {
    if (productId == "") {
      shopify.modal.hide("image-modal").then((val) => {
        shopify.toast.show("Product updated", {
          duration: 5000,
        });
      });
      reset();
    }
  }, [productId, shopify]);
  const products =
    user.data.products != null || user.data.products.length > 0
      ? user.data.products.edges.map((val) => {
        return {
          id: val.node.id,
          title: val.node.title,
          description: val.node.description,
          imageUrl:
            val.node.featuredImage == null
              ? null
              : val.node.featuredImage.url,
        };
      })
      : [];
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(products);

  const rowMarkup = products.map(
    ({ id, title, imageUrl, description }, index) => (
      //description == null || description == "" ? <></> :
        <TableRowComponent
          id={id}
          description={description}
          imageUrl={imageUrl}
          title={title}
          selectedResources={selectedResources}
          index={index}
          key={index}
        ></TableRowComponent>
    ),
  );

  async function getImageFromLLMAndDisplay(data) {
    /*
    if (user.data.plan.name == "Free") {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev",
        {
          headers: {
            "Authorization": "Bearer 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",
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify(data),
        }
      );
      const result = await response.blob();
      return result;
    } else {
     */
    const payload = {
      prompt: data.inputs,
      output_format: "jpeg"
    };

    const response = await axios.postForm(
      `https://api.stability.ai/v2beta/stable-image/generate/core`,
      axios.toFormData(payload, new FormData()),
      {
        validateStatus: undefined,
        responseType: "arraybuffer",
        headers: {
          Authorization: "Bearer sk-VbUYn4avUTS1eEr6doh1vRbEQnG9YOvDm1XUZcr62vKYb8zI",
          Accept: "image/*"
        },
      },
    );

    if (response.status === 200) {
      return new Blob([Buffer.from(response.data)]);
    } else {
      setUpdateInProgress(false);
      setError(response.data.toString());
      //throw new Error(`${response.status}: ${response.data.toString()}`);
    }

  }

  const promotedBulkActions = [
    {
      content: "Generate Image",
      onAction: () => {
        if (selectedResources.length > 1) {
          shopify.toast.show(
            "Only one product can be selected",
          );
          reset();
        } else {
          const product = products.filter(
            (product) => product.id == selectedResources[0],
          )[0];
          if(product.description==null || product.description==""){
            shopify.toast.show(
              "Product should have description already generated",
            ); 
          }else{
            setPrompt((prev) => ({ ...prev, prompt: "Generate a product image for a shopify store that that depicts the description mentioned as : " + product.description }))
            shopify.modal.show("image-modal");
          }
        }
      },
    },
  ];

  async function applyImage() {
    setUpdateInProgress(true);
    const product = products.filter(
      (product) => product.id == selectedResources[0],
    )[0];

    let reader = new FileReader();
    reader.readAsDataURL(imageBlob);
    reader.onloadend = function () {
      let base64String = reader.result;
      console.log("image", base64String.substr(base64String.indexOf(',') + 1))
      fetcher.submit(
        {
          id: selectedResources[0].substring(
            selectedResources[0].lastIndexOf("/") + 1,
          ),
          title: product.title,
          description: product.description,
          image: base64String.substr(base64String.indexOf(',') + 1)
        },
        { method: "POST" },
      );
    }


  }

  async function regenerateImage() {
    setRegenerate(true);
    const product = products.filter(
      (product) => product.id == selectedResources[0],
    )[0];
    setPrompt((prev) => ({ ...prev, prompt: "Re generate a product Image for a world class e-commerce store that depicts the description mentioned as : " + product.description }))
    await callImageGenerationModelAndGenerateImage();
  }
  async function callImageGenerationModelAndGenerateImage() {
    setUpdateInProgress(true);
    const image_blob = await getImageFromLLMAndDisplay({ "inputs": prompt.prompt });
    const url = URL.createObjectURL(image_blob);
    setImageUrl(url);
    setImageBlob(image_blob);
    setUpdateInProgress(false);
  }
  return (
    <Page fullWidth>
      <TitleBar title="Update Products"></TitleBar>
      <Modal onHide={reset} id="image-modal">
        <p style={{ padding: "10px" }}>
          Are you sure you want to generate the image?
        </p>
        <div
          style={{
            padding: '14px var(--p-space-200)'
          }}
        >
          {
            imageUrl == null ? <></> : <Thumbnail source={imageUrl} alt="Black choker necklace" />
          }
          <TextField
            disabled={true}
            value={prompt.prompt}
            onChange={(val) => setPrompt((prev) => ({ ...prev, prompt: val }))}
            label="Enter Prompt Message"
          />

          {updateInProgress ?
            <Spinner accessibilityLabel="Spinner example" size="large" /> : <></>}
          {error == null ? <></> : <Text> {error}</Text>}
        </div>
        {imageUrl == null ?
          <TitleBar title="Confirmation Message">
            <button disabled={updateInProgress ? true : false}
              onClick={() => {
                shopify.modal.hide("image-modal").then((val) => {
                  shopify.toast.show("Thanks", {
                    duration: 5000,
                  });
                });
              }}
            >
              No
            </button>
            <button disabled={updateInProgress ? true : false} onClick={callImageGenerationModelAndGenerateImage} variant="primary">
              Yes
            </button>
          </TitleBar> :
          <TitleBar title="Confirmation Message">
            {
              user.data.plan.name == "Free" ?
                <button disabled={updateInProgress ? true : false}
                  onClick={() => {
                    shopify.modal.hide("image-modal").then((val) => {
                      shopify.toast.show("Thanks", {
                        duration: 5000,
                      });
                      reset();
                    });
                  }}
                >
                  Ok
                </button> :
                <>
                  <button disabled={updateInProgress ? true : false} onClick={applyImage} variant="primary">
                    Apply
                  </button>
                  <button disabled={updateInProgress ? true : false} onClick={regenerateImage}>
                    Regenerate
                  </button>
                </>
            }

          </TitleBar>}
      </Modal>

      <Layout>
        <Layout.Section>
          {products.length == 0 ? (
            <EmptyState
              heading="No Products Found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            ></EmptyState>
          ) : (
            <Form method="post">
              <IndexTable
                resourceName={{
                  singular: "product",
                  plural: "products",
                }}
                itemCount={products.length}
                selectedItemsCount={
                  allResourcesSelected ? "All" : selectedResources.length
                }
                onSelectionChange={handleSelectionChange}
                headings={[
                  { title: "Image" },
                  { title: "Title" },
                  { title: "Description" },
                ]}
                promotedBulkActions={promotedBulkActions}
                pagination={{
                  hasNext: user.data.products.pageInfo.hasNextPage,
                  hasPrevious:user.data.products.pageInfo.hasPreviousPage,
                  onPrevious:()=>{
                    const cursor=user.data.products.edges[0].cursor;
                    searchParams.set('cursor', cursor);
                    searchParams.set("dir","before");
                    setSearchParams(searchParams);
                  },
                  onNext: ()=>{
                    const cursor=user.data.products.edges[user.data.products.edges.length-1].cursor;
                    //fetcher.load(`?cursor=${cursor}`);
                    searchParams.set('cursor', cursor);
                    searchParams.set("dir","after");
                    setSearchParams(searchParams);
   
                  }
                }}
              >
                {rowMarkup}
              </IndexTable>
            </Form>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
