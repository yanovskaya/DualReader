import { Router, type IRouter } from "express";
import healthRouter from "./health";
import booksRouter from "./books";
import translationsRouter from "./translations";
import dictionaryRouter from "./dictionary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booksRouter);
router.use(translationsRouter);
router.use(dictionaryRouter);

export default router;
