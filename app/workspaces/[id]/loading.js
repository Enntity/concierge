import Loader from "../../components/loader";

export default function Loading() {
    return (
        <div className="flex-1 bg-white dark:bg-gray-800 min-h-[50vh]">
            <div className="p-4">
                <Loader size="default" delay={0} />
            </div>
        </div>
    );
}
