import React, { useState } from "react";
import {
  useFirestoreQuery,
  useFirestoreDeleteData,
} from "../hooks/useFirestores";
import { collection, query, where, getDocs } from "firebase/firestore"; // Import Firestore methods
import { db } from "../firebase"; // Ensure your Firestore is correctly configured

const ContestSearchAndDelete = () => {
  const [contestId, setContestId] = useState("");
  const [inputId, setInputId] = useState("");
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [entryCount, setEntryCount] = useState(0);
  const [invoiceDocs, setInvoiceDocs] = useState([]);
  const [entryDocs, setEntryDocs] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [docsWithWrongId, setDocsWithWrongId] = useState([]);

  const { getDocuments } = useFirestoreQuery();
  const { deleteData: deleteInvoice } = useFirestoreDeleteData("invoices_pool");
  const { deleteData: deleteEntry } = useFirestoreDeleteData(
    "contest_entrys_list"
  );

  // Search by contestId in both collections
  const handleSearchByContestId = async () => {
    setErrorMessage("");
    if (!contestId) {
      setErrorMessage("Please enter a contest ID.");
      return;
    }

    try {
      const invoiceResults = await getDocuments("invoices_pool", [
        where("contestId", "==", contestId),
      ]);
      setInvoiceDocs(invoiceResults);
      setInvoiceCount(invoiceResults.length);

      const entryResults = await getDocuments("contest_entrys_list", [
        where("contestId", "==", contestId),
      ]);
      setEntryDocs(entryResults);
      setEntryCount(entryResults.length);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  // Search documents in invoices_pool where 'id' field is incorrect
  const handleSearchByWrongId = async () => {
    setErrorMessage(""); // Clear any previous errors
    if (!inputId) {
      setErrorMessage("Please enter an ID.");
      return;
    }

    try {
      // Create a reference to the 'invoices_pool' collection
      const invoicesRef = collection(db, "invoices_pool");

      // Build the query using the 'where' condition
      const q = query(invoicesRef, where("id", "==", inputId));

      // Execute the query and get a snapshot of the documents
      const fetchedDocsSnapshot = await getDocs(q);

      // If no documents are found, return a message
      if (fetchedDocsSnapshot.empty) {
        setErrorMessage("No documents found with the given id field.");
      } else {
        console.log(fetchedDocsSnapshot);

        // Extract document data from the snapshot
        const docsWithData = fetchedDocsSnapshot.docs.map((doc) => ({
          id: doc.id, // Firestore-assigned document ID
        }));

        console.log(docsWithData); // Verify the document data in the console
        setDocsWithWrongId(docsWithData); // Store the documents with the wrong 'id'
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  // Delete documents by contestId
  const handleDeleteByContestId = async () => {
    for (const doc of invoiceDocs) {
      try {
        await deleteInvoice(doc.id);
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
        await deleteEntry(doc.id);
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

  // Delete documents by incorrect 'id' field
  const handleDeleteByWrongId = async () => {
    if (docsWithWrongId.length === 0) {
      setErrorMessage("No documents to delete.");
      return;
    }

    for (const doc of docsWithWrongId) {
      console.log(
        `Deleting Firestore doc ID: ${doc.id}, with wrong field ID: ${doc.id}` // Firestore ID for deletion
      );

      try {
        await deleteInvoice(doc.id); // Deleting based on Firestore ID
        console.log(
          `Document with wrong id field (Firestore ID: ${doc.id}) deleted successfully.`
        );
      } catch (error) {
        console.error(
          `Failed to delete document with Firestore ID: ${doc.id}`,
          error
        );
      }
    }

    setDocsWithWrongId([]);
  };

  return (
    <div>
      <h1>Contest Search and Delete</h1>

      {/* Search by contestId */}
      <div>
        <label htmlFor="contestId">Contest ID: </label>
        <input
          type="text"
          id="contestId"
          value={contestId}
          onChange={(e) => setContestId(e.target.value)}
        />
        <button onClick={handleSearchByContestId}>Search by Contest ID</button>
      </div>

      <div>
        <h3>Results</h3>
        <p>Invoices in invoices_pool: {invoiceCount}</p>
        <p>Entries in contest_entrys_list: {entryCount}</p>
      </div>

      {invoiceCount > 0 || entryCount > 0 ? (
        <button onClick={handleDeleteByContestId}>Delete All</button>
      ) : (
        <p>No documents found.</p>
      )}

      {/* Search by wrong 'id' field */}
      <div>
        <label htmlFor="wrongId">Wrong ID Field: </label>
        <input
          type="text"
          placeholder="Enter ID value from 'id' field"
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
        />
        <button onClick={handleSearchByWrongId}>
          Search by Wrong ID Field
        </button>
      </div>

      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}

      {docsWithWrongId.length > 0 && (
        <div>
          <h3>
            Found {docsWithWrongId.length} document(s) with incorrect 'id' field
          </h3>
          <button onClick={handleDeleteByWrongId}>Delete Documents</button>
        </div>
      )}
    </div>
  );
};

export default ContestSearchAndDelete;
