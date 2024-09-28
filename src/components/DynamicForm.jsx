import { useFormik } from "formik";
import * as Yup from "yup";

function DynamicForm({ fields = [] }) {
  const initialValues = fields.reduce((acc, field) => {
    acc[field.name] = "";
    return acc;
  }, {});

  const validationSchema = Yup.object().shape(
    fields.reduce((acc, field) => {
      acc[field.name] =
        field.validation || Yup.string().required(`${field.label} is required`);
      return acc;
    }, {})
  );

  const onSubmit = (values, { resetForm }) => {
    console.log(values);
    resetForm();
  };

  const formik = useFormik({
    initialValues,
    validationSchema,
    onSubmit,
  });

  return (
    <form onSubmit={formik.handleSubmit}>
      {fields.map((field) => (
        <div key={field.name}>
          {field.type === "textarea" ? (
            <textarea
              id={field.name}
              name={field.name}
              onChange={formik.handleChange}
              value={formik.values[field.name]}
            />
          ) : (
            <input
              id={field.name}
              name={field.name}
              type={field.type || "text"}
              onChange={formik.handleChange}
              value={formik.values[field.name]}
            />
          )}
          {formik.errors[field.name] && formik.touched[field.name] && (
            <div>{formik.errors[field.name]}</div>
          )}
        </div>
      ))}
    </form>
  );
}

export default DynamicForm;
