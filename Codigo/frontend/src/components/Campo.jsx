// Campo de formulario con su etiqueta y su mensaje de error.
export default function Campo({ id, label, error, hint, ...props }) {
    return (
        <div className="campo">
            <label className="form-label" htmlFor={id}>{label}</label>
            <input
                id={id}
                name={id}
                className={`field${error ? ' invalid' : ''}`}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${id}-error` : undefined}
                {...props}
            />
            {error
                ? <p className="field-error" id={`${id}-error`}>{error}</p>
                : hint && <p className="field-hint">{hint}</p>}
        </div>
    );
}
