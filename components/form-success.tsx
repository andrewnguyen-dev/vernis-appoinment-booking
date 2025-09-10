import React from 'react'
import { MdCheckCircle } from "react-icons/md";

type FormESuccessProps = {
    message?: string
}

const FormSuccess = ({message}: FormESuccessProps) => {
    if (!message) return null
  return (
    <div className="bg-green-400/15 p-3 rounded-md flex items-center gap-x-2 text-sm text-destructive">
        <MdCheckCircle />
        {message}
    </div>
  )
}

export default FormSuccess