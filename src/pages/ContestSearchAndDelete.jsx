import React, { useState } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore"; // Firestore methods
import { db } from "../firebase"; // Ensure your Firestore is correctly configured

const ContestSearchAndDelete = () => {
  const [contestId, setContestId] = useState("");
  const [resultContestId, setResultContestId] = useState(""); // Separate state for contest results
  const [inputId, setInputId] = useState("");
  const [collectionName, setCollectionName] = useState(""); // New state for collection name
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [entryCount, setEntryCount] = useState(0);
  const [resultCount, setResultCount] = useState(0); // New state for contest results count
  const [collectionDocs, setCollectionDocs] = useState([]); // New state for collection documents
  const [invoiceDocs, setInvoiceDocs] = useState([]);
  const [entryDocs, setEntryDocs] = useState([]);
  const [resultDocs, setResultDocs] = useState([]); // New state for contest results docs
  const [errorMessage, setErrorMessage] = useState("");
  const [docsWithWrongId, setDocsWithWrongId] = useState([]);

  // Search by contestId in both invoices_pool and contest_entrys_list
  const handleSearchByContestId = async () => {
    setErrorMessage("");
    if (!contestId) {
      setErrorMessage("Please enter a contest ID.");
      return;
    }

    try {
      const invoiceResults = await getDocs(
        query(
          collection(db, "invoices_pool"),
          where("contestId", "==", contestId)
        )
      );
      setInvoiceDocs(
        invoiceResults.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      setInvoiceCount(invoiceResults.docs.length);

      const entryResults = await getDocs(
        query(
          collection(db, "contest_entrys_list"),
          where("contestId", "==", contestId)
        )
      );
      setEntryDocs(
        entryResults.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      setEntryCount(entryResults.docs.length);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  // Search by contestId in contest_results_list (separate)
  const handleSearchResultsByContestId = async () => {
    setErrorMessage("");
    if (!resultContestId) {
      setErrorMessage("Please enter a contest ID for results.");
      return;
    }

    try {
      const resultResults = await getDocs(
        query(
          collection(db, "contest_results_list"),
          where("contestId", "==", resultContestId)
        )
      );
      setResultDocs(
        resultResults.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      setResultCount(resultResults.docs.length);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  // Delete documents by contestId in both invoices_pool and contest_entrys_list
  const handleDeleteByContestId = async () => {
    for (const doc of invoiceDocs) {
      try {
        await deleteDoc(doc(db, "invoices_pool", doc.id));
        console.log(
          `Document ${doc.id} from invoices_pool deleted successfully.`
        );
      } catch (error) {
        console.error(
          `Failed to delete document ${doc.id} from invoices_pool:`,
          error
        );
      }
    }

    for (const doc of entryDocs) {
      try {
        await deleteDoc(doc(db, "contest_entrys_list", doc.id));
        console.log(
          `Document ${doc.id} from contest_entrys_list deleted successfully.`
        );
      } catch (error) {
        console.error(
          `Failed to delete document ${doc.id} from contest_entrys_list:`,
          error
        );
      }
    }

    setInvoiceDocs([]);
    setEntryDocs([]);
    setInvoiceCount(0);
    setEntryCount(0);
  };

  // Delete documents from contest_results_list by contestId
  const handleDeleteResultsByContestId = async () => {
    const failedDeletions = [];

    for (const resultDoc of resultDocs) {
      try {
        // Create the document reference using its ID
        const docRef = doc(db, "contest_results_list", resultDoc.id);
        await deleteDoc(docRef);
        console.log(
          `Document ${resultDoc.id} from contest_results_list deleted successfully.`
        );
      } catch (error) {
        console.error(
          `Failed to delete document ${resultDoc.id} from contest_results_list:`,
          error
        );
        failedDeletions.push(resultDoc.id); // Keep track of failed deletions
      }
    }

    // Retry failed deletions if any
    if (failedDeletions.length > 0) {
      console.log("Retrying failed deletions...");
      for (const failedId of failedDeletions) {
        try {
          const docRef = doc(db, "contest_results_list", failedId);
          await deleteDoc(docRef);
          console.log(
            `Document ${failedId} from contest_results_list deleted successfully on retry.`
          );
        } catch (error) {
          console.error(
            `Retry failed to delete document ${failedId} from contest_results_list:`,
            error
          );
        }
      }
    }

    // Clear the state after all attempts to delete
    setResultDocs([]);
    setResultCount(0);
  };

  // Search all documents in a specific collection
  const handleSearchByCollectionName = async () => {
    setErrorMessage("");
    if (!collectionName) {
      setErrorMessage("Please enter a collection name.");
      return;
    }

    try {
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (docs.length === 0) {
        setErrorMessage(
          `No documents found in the collection: ${collectionName}`
        );
      } else {
        setCollectionDocs(docs);
        console.log(docs);
      }
    } catch (error) {
      console.error("Error fetching collection documents:", error);
      setErrorMessage(
        "Error fetching documents. Please check the collection name."
      );
    }
  };

  // Delete all documents in a specific collection
  const handleDeleteByCollectionName = async () => {
    if (collectionDocs.length === 0) {
      setErrorMessage("No documents to delete.");
      return;
    }

    try {
      for (const docItem of collectionDocs) {
        const docRef = doc(db, collectionName, docItem.id); // Corrected document reference
        await deleteDoc(docRef); // Delete each document in the collection
        console.log(
          `Document ${docItem.id} from ${collectionName} deleted successfully.`
        );
      }

      setCollectionDocs([]);
      setErrorMessage(
        `All documents from ${collectionName} have been deleted.`
      );
    } catch (error) {
      console.error(`Error deleting documents from ${collectionName}:`, error);
      setErrorMessage(`Failed to delete documents from ${collectionName}`);
    }
  };

  return (
    <div>
      <h1>Contest Search and Delete</h1>

      {/* Search by contestId in invoices_pool and contest_entrys_list */}
      <div>
        <h2>Search and Delete Entries/Invoices</h2>
        <label htmlFor="contestId">Contest ID: </label>
        <input
          type="text"
          id="contestId"
          value={contestId}
          onChange={(e) => setContestId(e.target.value)}
        />
        <button onClick={handleSearchByContestId}>Search by Contest ID</button>

        <div>
          <h3>Results</h3>
          <p>Invoices in invoices_pool: {invoiceCount}</p>
          <p>Entries in contest_entrys_list: {entryCount}</p>
        </div>

        {invoiceCount > 0 || entryCount > 0 ? (
          <button onClick={handleDeleteByContestId}>
            Delete All Entries/Invoices
          </button>
        ) : (
          <p>No documents found.</p>
        )}
      </div>

      {/* Search by contestId in contest_results_list (separate) */}
      <div>
        <h2>Search and Delete Results</h2>
        <label htmlFor="resultContestId">Contest ID (Results): </label>
        <input
          type="text"
          id="resultContestId"
          value={resultContestId}
          onChange={(e) => setResultContestId(e.target.value)}
        />
        <button onClick={handleSearchResultsByContestId}>
          Search by Contest ID (Results)
        </button>

        <div>
          <h3>Results in contest_results_list</h3>
          <p>Results in contest_results_list: {resultCount}</p>
        </div>

        {resultCount > 0 ? (
          <button onClick={handleDeleteResultsByContestId}>
            Delete All Results
          </button>
        ) : (
          <p>No documents found.</p>
        )}
      </div>

      {/* Search and delete all documents in a specific collection */}
      <div>
        <h2>Delete All Documents in Collection</h2>
        <label htmlFor="collectionName">Collection Name: </label>
        <input
          type="text"
          id="collectionName"
          value={collectionName}
          onChange={(e) => setCollectionName(e.target.value)}
        />
        <button onClick={handleSearchByCollectionName}>
          Search Collection
        </button>

        {collectionDocs.length > 0 && (
          <>
            <h3>
              Found {collectionDocs.length} document(s) in {collectionName}
            </h3>
            <button onClick={handleDeleteByCollectionName}>
              Delete All Documents
            </button>
          </>
        )}
        {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
      </div>
    </div>
  );
};

export default ContestSearchAndDelete;
