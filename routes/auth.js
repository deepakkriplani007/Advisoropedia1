import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { body, ExpressValidator, validationResult } from "express-validator";
import usermodel from "../models/usermodel.js";
const Router = express.Router();
const SECRET_KEY = "deepak";
Router.get("/", async (req, res) => {
  try {
    const allusers = await usermodel.find();
    res.status(200).json(allusers);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});
Router.post("/createuser", async (req, res) => {
  try {
    const user = await usermodel.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      passwordconfirm: req.body.passwordconfirm,
    });
    const token = jwt.sign({ id: user._id }, SECRET_KEY, { expiresIn: "35m" });
    req.headers.token = token;
    res.status(200).json({ token, status: "success" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
Router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await usermodel.findOne({ email }).select("+password");
    if (!user)
      throw {
        statusCode: 404,
        message: "Signup first",
        status: "fail",
      };
    if (!(await bcrypt.compare(password, user.password))) {
      // console.log(user.count + "before");

      if (user.count > 2 && user.block < Date.now()) {
        user.block = Date.now() + 30 * 1000;
        await user.save({ validateBeforeSave: false });
        throw {
          statusCode: 400,
          message: "unauthorized access limit reached try after 30sec",
          status: "fail",
        };
      } else {
        user.count++;
        await user.save({ validateBeforeSave: false });
      }
      if (user.block > Date.now()) {
        throw {
          statusCode: 300,
          message: `User is blocked. Time remain: ${user.block - Date.now()}ms`,
          status: "fail",
        };
      }
      // console.log(user.count + "after");
      throw {
        statusCode: 400,
        message: "Invalid password",
        status: "fail",
      };
    } else {
      user.count = 0;
      await user.save({ validateBeforeSave: false });
    }
    // console.log(user);
    const id = user._id;
    const token = jwt.sign({ id: id }, SECRET_KEY, { expiresIn: "35m" });
    res.status(200).json({ token });
  } catch (error) {
    res.status(error.statusCode).json({ error: error.message });
  }
});
Router.get("/finduser/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const query = usermodel.findOne({ _id: id });

    const user = await query;
    await user.save({ validateBeforeSave: false });
    res.status(200).json({ user: user, status: "success" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// mailer
Router.post("/forgotpassword", async function (req, res) {
  try {
    const user = await usermodel.findOne({ email: req.body.email });
    if (!user) res.status(400).json({ message: "Error sending the email" });
    const resetToken = user.generateToken();
    await user.save({ validateBeforeSave: false });
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "imt_2021027@iiitm.ac.in",
        pass: "bmbm oiwc pgou ugdv",
      },
    });
    const mailOptions = {
      from: "imt_2021027@iiitm.ac.in",
      to: user.email,
      subject: "Password reset token sent",
      text: `Use it as Token:${resetToken}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        res.status(400).json({ message: "Error sending the email" });
      } else {
        res.status(200).json({ message: "Email sent successfully" });
      }
    });
  } catch (error) {
    res.status(error.statusCode).json({ error: error.message });
  }
});

Router.post("/resetpassword/:resetToken", async function (req, res) {
  try {
    const token = req.params.resetToken;
    const { password, passwordconfirm } = req.body;
    if (!token) throw { statusCode: 400, message: "No token available" };
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await usermodel.findOne({
      passwordResetToken: hashedToken,
      TokenExpires: { $gt: Date.now() },
    });
    if (!user) throw { statusCode: 400, message: "user does not exist" };
    user.password = password;
    user.passwordconfirm = passwordconfirm;
    user.passwordResetToken = undefined;
    user.TokenExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
export default Router;
