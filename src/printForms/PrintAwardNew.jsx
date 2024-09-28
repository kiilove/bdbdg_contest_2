import React, { useState } from "react";
import { useFirestoreQuery } from "../hooks/useFirestores";

const PrintAwardNew = () => {
  const [awardsArray, setAwardsArray] = useState([]);
  const fetchQuery = useFirestoreQuery();
  const fetchPool = async () => {};

  return <div>PrintAwardNew</div>;
};

export default PrintAwardNew;
