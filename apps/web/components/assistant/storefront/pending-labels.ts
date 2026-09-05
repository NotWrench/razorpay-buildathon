/** What to say while a storefront tool is still running. */
export function storefrontPendingLabel(type: string): string {
  switch (type) {
    case "tool-searchProducts":
      return "Searching the catalog…";
    case "tool-searchWeb":
      return "Searching the web for PC trends…";
    case "tool-compareProducts":
      return "Reading both spec sheets…";
    case "tool-checkBuildCompatibility":
      return "Checking the parts against each other…";
    case "tool-createBuild":
    case "tool-updateBuild":
      return "Saving the build…";
    case "tool-addToCart":
    case "tool-addBuildToCart":
    case "tool-removeFromCart":
      return "Updating the cart…";
    case "tool-quoteOrder":
      return "Pricing your cart…";
    case "tool-createOrder":
      return "Creating the order…";
    case "tool-suggestUpsell":
      return "Checking what pairs with this…";
    case "tool-getOrderStatus":
      return "Checking the order…";
    default:
      return "Working…";
  }
}
