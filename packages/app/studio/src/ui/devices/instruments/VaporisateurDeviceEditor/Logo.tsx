import {createElement} from "@opendaw/lib-jsx"
import {Colors} from "@opendaw/studio-core"

export const Logo = () => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill={Colors.shadow} stroke="none">
            <path
                d="M30 78h40a11 11 0 0 0 11-11V33a11 11 0 0 0-11-11H30a11 11 0 0 0-11 11v34a11 11 0 0 0 11 11m-5-45a5 5 0 0 1 5-5h40a5 5 0 0 1 5 5v11H25Zm8 17v14h6V50h8v14h6V50h8v14h6V50h8v17a5 5 0 0 1-5 5H30a5 5 0 0 1-5-5V50Z"/>
            <circle cx="45" cy="36" r="3"/>
            <circle cx="34" cy="36" r="3"/>
        </svg>
    )
}