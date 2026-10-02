// Temporary page used by every route until its milestone builds the real one.
export default function Placeholder({ title, note }) {
  return (
    <main className="page">
      <h1>{title}</h1>
      {note && <p>{note}</p>}
    </main>
  );
}
