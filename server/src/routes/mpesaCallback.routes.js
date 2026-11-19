
import { Router } from "express";

import {
  receiveMpesaStkCallback,
} from "../controllers/mpesaCallback.controller.js";

const router = Router();

router.post("/stk", receiveMpesaStkCallback);

export default router;
