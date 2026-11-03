export default function Benefits({ items }) {
    return (
        <div className="benefits">
            {items.map(([icon, title, text]) => (
                <article className="benefit" key={title}>
                    <i>{icon}</i>
                    <h3>{title}</h3>
                    <p>{text}</p>
                </article>
            ))}
        </div>
    );
}
