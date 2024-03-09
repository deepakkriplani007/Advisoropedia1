const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const usermodel = require("../models/usermodel");

const SECRET_KEY = "hardik";
const fetchuser = async (req, res, next) => {
  try {
    const token = req.headers.token;
    if (!token) {
      throw {
        statusCode: 404,
        message: "Log in or signup first",
        status: "fail",
      };
    }
    const decoded = jwt.verify(token, SECRET_KEY);

    const user = await usermodel.findOne({ _id: decoded.id });
    if (
      user.passwordChangedAt &&
      user.changedPasswordAfter(decoded.iat, user.passwordChangedAt)
    ) {
      throw {
        statusCode: 400,
        message: "Password changed after token issued",
        status: "fail",
      };
    }
    if (!user) {
      throw { statusCode: 404, message: "User does not exist", status: "fail" };
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
module.exports = fetchuser;
