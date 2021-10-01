const axios = require("axios");

const SnipCart = function(auth) {
  this.key = auth;

  this.callApi = async function(call, data = {}, method = "get") {
    method = method.toUpperCase();

    call = encodeURI(call);

    if (method == "GET") {
      const urlParams = Object.keys(data).map((key) =>
        encodeURIComponent(key) + "=" + encodeURIComponent(data[key])
      ).join("&");
      call += (urlParams ? "?" + urlParams : "");
    }

    const response = await axios({
      baseURL: "https://app.snipcart.com/api",
      url: call,
      data,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      auth: {
        username: this.key, password: ""
      },
      method
    });

    return response.data;
  };

  // DISCOUNTS

  this.deleteDiscount = function(discount) {
    const id = ((typeof discount == "string") ? discount : discount.id);
    return this.callApi(`/discounts/${id}`, null, "DELETE");
  };

  this.editDiscount = function(discount) {
    return this.callApi(`/discounts/${discount.id}`, discount, "PUT");
  };

  this.getDiscountCode = function(code) {
    return new Promise((fulfill, reject) => {
      this.callApi("/discounts").then(discounts =>
        fulfill(discounts.find(d => d.code == code))
      ).catch(reject);
    });
  };

  this.getDiscounts = function() {
    return this.callApi("/discounts");
  };

  this.newDiscount = function(discount) {
    return this.callApi("/discounts", discount, "POST");
  };

  return this;
};

module.exports = SnipCart;
