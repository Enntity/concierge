import Loader from "../components/loader";

export default function Loading() {
    return (
        <div className="min-h-screen bg-white dark:bg-gray-800">
            <div className="p-4">
                <Loader size="default" delay={0} />
            </div>
        </div>
    );
}
