import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Row, Col, ListGroup, Button, Image, Card } from "react-bootstrap";
import {
  useGetOrderDetailsQuery,
  usePayOrderMutation,
  useUpdateDeliverMutation,
  // useGetPayPalClientIdQuery,
} from "../slices/ordersApiSlice";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import Loader from "../components/Loader";
import Message from "../components/Message";
import Meta from "../components/Meta";
import { addCurrency } from "../utils/addCurrency";
import axios from "axios";

const OrderDetailsPage = () => {
  const { id: orderId } = useParams();
  const { data: order, isLoading, error } = useGetOrderDetailsQuery(orderId);
  const [payOrder, { isLoading: isPayOrderLoading }] = usePayOrderMutation();
  const [updateDeliver, { isLoading: isUpdateDeliverLoading }] =
    useUpdateDeliverMutation();
  const { userInfo } = useSelector((state) => state.auth);
  // const { data: paypalClientId } = useGetPayPalClientIdQuery();
  const [sdkReady, setSdkReady] = useState(true);

  // useEffect(() => {
  //   if (paypalClientId) {
  //     setSdkReady(true);
  //   }
  // }, [paypalClientId]);

  const successPaymentHandler = async (details) => {
    console.log(details);
    try {
      await payOrder({ orderId, details });
      toast.success("Payment successful");
    } catch (error) {
      toast.error(error?.data?.message || error.message);
    }
  };

  const deliveredHandler = async () => {
    try {
      await updateDeliver(orderId);
      toast.success("Order Delivered");
    } catch (error) {
      toast.error(error?.data?.message || error.message);
    }
  };

  const createOrder = async () => {
    console.log("hello");
    const response = await fetch(
      `http://localhost:5000/api/v1/orders/paypal/create-order`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: order.totalPrice }),
      }
    );
    const data = await response.json();
    console.log(data);
    return data.id; // Order ID
  };

  const onApprove = async (data) => {
    const response = await fetch(
      `http://localhost:5000/api/v1/orders/paypal/capture-order`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderID: data.orderID }),
      }
    );

    const captureData = await response.json();
    console.log("Payment Captured:", captureData);
    try {
      await payOrder({ orderId, captureData });
      toast.success("Payment successful");
    } catch (error) {
      toast.error(error?.data?.message || error.message);
    }
  };
  return (
    <>
      {isLoading ? (
        <Loader />
      ) : error ? (
        <Message variant="danger">
          {error?.data?.message || error.message}
        </Message>
      ) : (
        <>
          <Meta title={"Order Details"} />
          <h1>Order ID: {orderId}</h1>
          <Row>
            <Col md={8}>
              <ListGroup variant="flush">
                <ListGroup.Item>
                  <h2>Shipping</h2>
                  <div>
                    <strong>Name:</strong> {order?.user?.name}
                  </div>
                  <div>
                    <strong>Email:</strong> {order?.user?.email}
                  </div>
                  <div>
                    <strong>Address:</strong> {order?.shippingAddress?.address},
                    {order?.shippingAddress?.city},{" "}
                    {order?.shippingAddress?.postalCode},
                    {order?.shippingAddress?.country}
                  </div>
                  {order?.isDelivered ? (
                    <Message variant="success">
                      Delivered on{" "}
                      {new Date(order?.deliveredAt).toLocaleString()}
                    </Message>
                  ) : (
                    <Message variant="danger">Not Delivered</Message>
                  )}
                </ListGroup.Item>

                <ListGroup.Item>
                  <h2>Payment Method</h2>
                  <div>
                    <strong>Method:</strong> {order?.paymentMethod}
                  </div>
                  {order?.isPaid ? (
                    <Message variant="success">
                      Paid on {new Date(order?.paidAt).toLocaleString()}
                    </Message>
                  ) : (
                    <Message variant="danger">Not paid</Message>
                  )}
                </ListGroup.Item>

                <ListGroup.Item>
                  <h2>Order Items</h2>
                  <ListGroup variant="flush">
                    {order?.orderItems?.map((item) => (
                      <ListGroup.Item key={item._id}>
                        <Row>
                          <Col md={2}>
                            <Image
                              src={item.image}
                              alt={item.name}
                              fluid
                              rounded
                            />
                          </Col>
                          <Col md={6}>
                            <Link
                              to={`/product/${item._id}`}
                              className="text-dark"
                              style={{ textDecoration: "none" }}
                            >
                              {item.name}
                            </Link>
                          </Col>
                          <Col md={4}>
                            {item.qty} x {addCurrency(item.price)} ={" "}
                            {addCurrency(item.qty * item.price)}
                          </Col>
                        </Row>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </ListGroup.Item>
              </ListGroup>
            </Col>

            <Col md={4}>
              <Card>
                <ListGroup variant="flush">
                  <ListGroup.Item>
                    <h2>Order Summary</h2>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <Row>
                      <Col>Items:</Col>
                      <Col>{addCurrency(order?.itemsPrice)}</Col>
                    </Row>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <Row>
                      <Col>Shipping:</Col>
                      <Col>{addCurrency(order?.shippingPrice)}</Col>
                    </Row>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <Row>
                      <Col>Tax:</Col>
                      <Col>{addCurrency(order?.taxPrice)}</Col>
                    </Row>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <Row>
                      <Col>Total:</Col>
                      <Col>{addCurrency(order?.totalPrice)}</Col>
                    </Row>
                  </ListGroup.Item>

                  {!order?.isPaid && userInfo.isAdmin && (
                    <ListGroup.Item>
                      {sdkReady ? (
                        <PayPalScriptProvider
                          options={{
                            "client-id":
                              "AaxvEF51oFW9PgKxWtpCELNFWPtGTHac1RftYMvIZxW_BL_AYaj0atnRhemesP_4S7cshTFwfxMlmjoq",
                          }}
                        >
                          <PayPalButtons
                            amount={order?.totalPrice}
                            createOrder={createOrder}
                            onApprove={onApprove}
                            onSuccess={successPaymentHandler}
                          />
                        </PayPalScriptProvider>
                      ) : (
                        <Loader />
                      )}
                    </ListGroup.Item>
                  )}

                  {userInfo &&
                    userInfo.isAdmin &&
                    order?.isPaid &&
                    !order?.isDelivered && (
                      <ListGroup.Item>
                        <Button
                          onClick={deliveredHandler}
                          variant="warning"
                          disabled={isUpdateDeliverLoading}
                          style={{ marginBottom: "10px" }}
                        >
                          Mark As Delivered
                        </Button>
                      </ListGroup.Item>
                    )}
                </ListGroup>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </>
  );
};

export default OrderDetailsPage;
